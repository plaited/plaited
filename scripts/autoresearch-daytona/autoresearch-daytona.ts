/**
 * Daytona sandbox wrapper for the autoresearch loop.
 *
 * @remarks
 * The hosting layer: create a Daytona sandbox → clone the repo → run the gate
 * in the sandbox → report the verdict → host-side promote/discard. The gate
 * logic is reused from `src/kernel/autoresearch.ts` — this module does not
 * re-implement it.
 *
 * Two entry points:
 * - **Scripted** (`demo:autoresearch`): deterministic generator, safe demo.
 * - **Model** (`demo:autoresearch:model`): GLM host-side generator, gate in sandbox.
 *
 * Fork-isolation beat: run a broken candidate in a fork, show parent untouched.
 *
 * Deps strategy: `bun install` in the sandbox (option a). The gate's only
 * external npm runtime dep is `ajv` — install is seconds, not minutes.
 * Fork amortizes: parent installs once, forks are instant.
 * Upgrade path: bake a Daytona snapshot with deps pre-installed for speed.
 *
 * @packageDocumentation
 */

import type { Sandbox } from '@daytonaio/sdk'
import { Daytona } from '@daytonaio/sdk'
import type { BPEvent, Thread } from '../../src/behavioral/behavioral.types.ts'
import {
  createModelGenerator,
  type GateInput,
  type GateResult,
  type LoopConfig,
  type LoopEntry,
  type LoopResult,
  runAutoresearchLoop,
  serializeResultsLog,
} from '../../src/kernel/autoresearch.ts'
import { PROGRESSIVE_DISCLOSURE_THREAD } from '../../src/kernel/threads.ts'
import type { FrontierStateNode } from '../../src/tools/frontier.ts'
import { createModelTools } from '../../src/tools/model.ts'

// ---------------------------------------------------------------------------
// Config — secrets from env, never committed
// ---------------------------------------------------------------------------

/** Required environment for the wrapper. */
export type WrapperEnv = {
  DAYTONA_API_KEY: string
  OPENROUTER_API_KEY: string
  YDC_API_KEY: string
}

/** Read secrets from the environment; throw if missing. */
const readEnv = (): WrapperEnv => {
  const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  const YDC_API_KEY = process.env.YDC_API_KEY
  if (!DAYTONA_API_KEY) throw new Error('DAYTONA_API_KEY is required')
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required')
  if (!YDC_API_KEY) throw new Error('YDC_API_KEY is required')
  return { DAYTONA_API_KEY, OPENROUTER_API_KEY, YDC_API_KEY }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_URL = 'https://github.com/plaited/behavioral.git'
const REPO_PATH = 'workspace/repo'
const SPACE = 'daytona-demo'
const MAX_DEPTH = 20
const MAX_ITERATIONS = 3
// Fork requires a linux-vm class sandbox; the default snapshot is container-based.
const VM_SNAPSHOT = 'daytona-vm-small'

const GATE_TRIGGERS: BPEvent[] = [
  { type: 'user.prompt', space: SPACE },
  { type: 'discovery.results', space: SPACE },
  { type: 'model.result', space: SPACE },
  { type: 'tool.loaded', space: SPACE },
  { type: 'turn.end', space: SPACE },
]

// ---------------------------------------------------------------------------
// Sandbox gate result — the JSON shape the sandbox prints
// ---------------------------------------------------------------------------

/** The verdict returned by the sandbox gate. */
export type SandboxGateResult = {
  verifyStatus: string
  targetReached: boolean
  kept: boolean
  trace: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Story renderers — before/after contrast, explored path, verdict
// ---------------------------------------------------------------------------

/**
 * Derive a one-line discard reason from the trace when targetReached is false.
 *
 * Checks which required phase edges (discovery.search, skill.read) are missing
 * from the state graph — the progressive-disclosure target requires both on
 * some path to a terminal idle node. If both are present but no path reaches
 * a terminal idle, the thread deadlocks before completing.
 */
const deriveDiscardReason = (entry: LoopEntry): string => {
  if (entry.verifyStatus !== 'verified') {
    return `safety gate failed (${entry.verifyStatus})`
  }
  const allTypes = new Set<string>()
  for (const node of Object.values(entry.trace)) {
    for (const succ of node.successors) {
      allTypes.add(succ.selection.type)
    }
  }
  const missing: string[] = []
  if (!allTypes.has('discovery.search')) missing.push('discovery.search')
  if (!allTypes.has('skill.read')) missing.push('skill.read')
  if (missing.length > 0) {
    return `no ${missing.join(' or ')} edge on any path`
  }
  return 'no path to a terminal idle with both phases'
}

/**
 * Extract the request event types from a thread's rules (the 'request' steps).
 * These are the phases the thread drives through (search, model, load, etc.).
 */
const requestTypes = (thread: Thread): string[] =>
  thread.rules.filter((r): r is { request: { type: string } } => 'request' in r).map((r) => r.request.type)

/**
 * Format the before/after contrast — the self-improvement arc.
 *
 * Shows the starting thread and the candidate side by side: label, rule count,
 * and the one-line difference (which step is missing/restored).
 *
 * @param before - The current thread (the starting point).
 * @param after - The candidate thread (the proposal/correction).
 * @public
 */
export const formatContrast = (before: Thread, after: Thread): string => {
  const beforeTypes = new Set(requestTypes(before))
  const afterTypes = new Set(requestTypes(after))
  const restored = [...afterTypes].filter((t) => !beforeTypes.has(t))
  const removed = [...beforeTypes].filter((t) => !afterTypes.has(t))

  const beforeLabel = `${before.label} (${before.rules.length} rules)`
  const afterLabel = `${after.label} (${after.rules.length} rules)`

  let diff: string
  if (restored.length > 0) {
    diff = `${restored.join(', ')} restored`
  } else if (removed.length > 0) {
    diff = `${removed.join(', ')} removed`
  } else if (before.label === after.label && before.rules.length === after.rules.length) {
    diff = 'no change'
  } else {
    diff = 'restructured'
  }

  // The before line shows what the starting thread is missing (what after has that before doesn't).
  const beforeMissing =
    restored.length > 0
      ? `missing ${restored.join(', ')}`
      : diff === 'no change'
        ? 'unchanged'
        : removed.length > 0
          ? `has extra ${removed.join(', ')}`
          : diff

  return [`  before : ${beforeLabel} — ${beforeMissing}`, `  after  : ${afterLabel} — ${diff}`].join('\n')
}

/**
 * Walk the trace state graph from the root and extract the event sequence
 * of the path that reaches the target (for KEEP) or the longest path
 * (for DISCARD).
 *
 * The trace is the frontier-explore state graph: each node has
 * `successors[].selection.type` (the event that transitions to the next
 * state) and `successors[].to` (the next state's key). A terminal node
 * has no successors.
 *
 * For KEEP: finds the root→terminal path that includes both
 * 'discovery.search' and 'skill.read' (the target predicate's criteria).
 * For DISCARD: finds the longest root→terminal path (the point where the
 * thread dies).
 *
 * @param trace - The state graph from {@link LoopEntry.trace}.
 * @param targetReached - Whether the target predicate passed.
 * @returns Arrow-joined event types (e.g. "user.prompt → discovery.search → ...").
 * @public
 */
export const extractPathFromTrace = (trace: Record<string, FrontierStateNode>, targetReached: boolean): string => {
  const nodes = Object.values(trace)
  const root = nodes.find((n) => n.step === 0)
  if (!root) return ''

  // DFS to find a path from a node to a terminal (no successors).
  // Returns the sequence of event types along the path.
  const findPath = (nodeKey: string, visited: Set<string>): string[] | null => {
    const node = trace[nodeKey]
    if (!node) return null
    if (node.successors.length === 0) {
      // Terminal node — path ends here (no event to add).
      return []
    }
    for (const succ of node.successors) {
      if (visited.has(succ.to)) continue
      const newVisited = new Set(visited)
      newVisited.add(succ.to)
      const subPath = findPath(succ.to, newVisited)
      if (subPath !== null) {
        return [succ.selection.type, ...subPath]
      }
    }
    return null
  }

  // For KEEP: find the path that includes both discovery.search and skill.read.
  // For DISCARD: find the longest path.
  let bestPath: string[] | null = null

  for (const succ of root.successors) {
    const newVisited = new Set([succ.to])
    const subPath = findPath(succ.to, newVisited)
    if (subPath !== null) {
      const fullPath = [succ.selection.type, ...subPath]
      if (targetReached) {
        // For KEEP: check if this path has both required phases.
        const pathTypes = new Set(fullPath)
        if (pathTypes.has('discovery.search') && pathTypes.has('skill.read')) {
          bestPath = fullPath
          break
        }
      }
      // For DISCARD or KEEP fallback: track the longest path.
      if (bestPath === null || fullPath.length > bestPath.length) {
        bestPath = fullPath
      }
    }
  }

  if (bestPath === null) return ''
  return bestPath.join(' → ')
}

/**
 * Format a loop result as a readable story — before/after contrast,
 * the gate's explored path, and the verdict. The two-part gate
 * (safety + usefulness) is the punchline.
 *
 * For multiple iterations: the winning iteration gets the full story
 * (contrast + path + verdict); prior discards get a one-line summary.
 * If no candidate passes, each iteration gets a compact verdict line.
 *
 * @param result - The loop result from {@link runAutoresearchLoop}.
 * @param tag - The demo tag (e.g. 'demo:autoresearch').
 * @param currentThread - The starting thread (for the before/after contrast).
 * @public
 */
export const formatStory = (result: LoopResult, tag: string, currentThread: Thread): string => {
  const lines: string[] = []
  const promoted = result.iterations.find((i) => i.kept)

  if (promoted) {
    // Winning iteration: full story.
    // Prior discards: one-line summary.
    for (const entry of result.iterations) {
      if (!entry.kept) {
        lines.push(`  iter ${entry.iteration}: DISCARD (${deriveDiscardReason(entry)})`)
      }
    }

    // Contrast
    lines.push('')
    lines.push(formatContrast(currentThread, promoted.candidate))

    // Explored path
    const path = extractPathFromTrace(promoted.trace, true)
    lines.push('')
    lines.push("  the gate explored the thread's futures:")
    if (path) {
      lines.push(`    ${path}`)
      lines.push('    \u2713 reached the goal state (terminal idle) via this path')
    } else {
      lines.push('    (no path found in trace)')
    }

    // Verdict
    lines.push('')
    lines.push(`  safety  : ${promoted.verifyStatus.padEnd(20)} (frontier-verify — no deadlock/livelock)`)
    const useful = promoted.targetReached ? 'target reached' : 'target not reached'
    lines.push(`  useful  : ${useful.padEnd(20)} (frontier-explore — some valid path to goal)`)
    lines.push(`  verdict : KEEP`)
  } else {
    // All discards — no promote.
    lines.push('')
    for (const entry of result.iterations) {
      // Contrast for the first iteration only (subsequent ones have the same current thread).
      if (entry.iteration === 0) {
        lines.push(formatContrast(currentThread, entry.candidate))
        lines.push('')
      }
      // Explored path
      const path = extractPathFromTrace(entry.trace, false)
      lines.push("  the gate explored the thread's futures:")
      if (path) {
        lines.push(`    ${path}`)
        const reason = deriveDiscardReason(entry)
        lines.push(`    \u2717 ${reason}`)
      }
      lines.push('')
      lines.push(`  iter ${entry.iteration}: DISCARD (${deriveDiscardReason(entry)})`)
    }
    lines.push('')
    lines.push('  No candidate passed the gate.')
  }

  return lines.join('\n')
}

/**
 * Format a loop result as a readable summary — verdict-led, two-part gate
 * as labeled lines, candidate summarized (label + rule count), trace omitted.
 *
 * @param result - The loop result from {@link runAutoresearchLoop}.
 * @param tag - The demo tag (e.g. 'demo:autoresearch').
 * @public
 */
export const formatSummary = (result: LoopResult, tag: string): string => {
  const lines: string[] = []
  for (const entry of result.iterations) {
    lines.push(`[${tag}] iteration ${entry.iteration}`)
    lines.push(`  candidate : ${entry.candidate.label} (${entry.candidate.rules.length} rules)`)
    lines.push(`  safety    : ${entry.verifyStatus.padEnd(20)} (frontier-verify — no deadlock/livelock)`)
    const useful = entry.targetReached ? 'target reached' : 'target not reached'
    lines.push(`  useful    : ${useful.padEnd(20)} (frontier-explore — some valid path to goal)`)
    if (entry.kept) {
      lines.push(`  verdict   : KEEP`)
    } else {
      lines.push(`  verdict   : DISCARD (${deriveDiscardReason(entry)})`)
    }
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// buildGateScript — the self-contained TS script that runs in the sandbox
// ---------------------------------------------------------------------------

/** Parameters for {@link buildGateScript}. */
export type GateScriptParams = {
  candidate: Thread
  triggers: BPEvent[]
  maxDepth: number
  space: string
}

/**
 * Build a self-contained TypeScript script that imports the gate from the
 * cloned repo and prints the result as JSON to stdout. The host captures
 * stdout and parses the {@link SandboxGateResult}.
 *
 * If the candidate is the progressive-disclosure thread (importable from
 * `threads.ts`), the script imports it directly — no inline JSON needed.
 * Otherwise, the candidate JSON is inlined.
 *
 * @public
 */
export const buildGateScript = ({ candidate, triggers, maxDepth, space }: GateScriptParams): string => {
  const triggersJson = JSON.stringify(triggers)
  const isProgressiveThread =
    candidate.label === PROGRESSIVE_DISCLOSURE_THREAD.label &&
    candidate.rules.length === PROGRESSIVE_DISCLOSURE_THREAD.rules.length

  const candidateRef = isProgressiveThread ? 'PROGRESSIVE_DISCLOSURE_THREAD' : JSON.stringify(candidate)

  const importLine = isProgressiveThread
    ? `import { PROGRESSIVE_DISCLOSURE_THREAD } from './src/kernel/threads.ts'`
    : ''

  return `import { gateCandidate } from './src/kernel/autoresearch.ts'
${importLine}

const candidate = ${candidateRef}
const triggers = ${triggersJson}

const result = await gateCandidate({
  candidate,
  triggers,
  maxDepth: ${maxDepth},
  space: '${space}',
})

console.log(JSON.stringify(result))
`
}

// ---------------------------------------------------------------------------
// createSandboxGate — the Gate function that delegates to the sandbox
// ---------------------------------------------------------------------------

/**
 * Create a gate function that runs {@link gateCandidate} inside a Daytona
 * sandbox. The candidate JSON is embedded in a TS script, executed via
 * `process.codeRun`, and the stdout JSON is parsed back as {@link GateResult}.
 *
 * @param sandbox - A ready Daytona sandbox with the repo cloned + deps installed.
 * @public
 */
export const createSandboxGate = (sandbox: Sandbox) => {
  return async (input: GateInput): Promise<GateResult> => {
    const script = buildGateScript({
      candidate: input.candidate,
      triggers: input.triggers,
      maxDepth: input.maxDepth,
      space: input.space,
    })

    // Write the gate script into the repo root, then execute from there.
    // Relative imports (./src/...) resolve against the repo root.
    const remotePath = `${REPO_PATH}/gate-runner.ts`
    await sandbox.fs.uploadFile(Buffer.from(script), remotePath)

    const result = await sandbox.process.executeCommand(`bun run gate-runner.ts`, REPO_PATH)

    if (result.exitCode !== 0) {
      throw new Error(`Gate failed in sandbox (exit ${result.exitCode}): ${result.result}`)
    }

    const parsed = JSON.parse(result.result) as GateResult
    return parsed
  }
}

// ---------------------------------------------------------------------------
// setupSandbox — create, clone, install deps
// ---------------------------------------------------------------------------

/**
 * Delete any existing sandbox with the given name. Prevents 409 conflicts
 * when a previous run crashed and left a stale sandbox behind.
 */
const deleteExistingSandbox = async (daytona: Daytona, name: string): Promise<void> => {
  try {
    const existing = await daytona.get(name)
    await daytona.delete(existing)
    console.log(`[setup] Deleted stale sandbox: ${name}`)
  } catch {
    // No existing sandbox with this name — nothing to clean up.
  }
}

/**
 * Create a Daytona sandbox, clone the repo, and install deps.
 *
 * @param env - API keys.
 * @param name - Optional sandbox name.
 * @returns The ready sandbox.
 *
 * @public
 */
export const setupSandbox = async (env: WrapperEnv, name?: string): Promise<Sandbox> => {
  const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })

  if (name !== undefined) {
    await deleteExistingSandbox(daytona, name)
  }

  // The SDK create() accepts CreateSandboxFromImageParams | CreateSandboxFromSnapshotParams;
  // when neither image nor snapshot is given, it defaults to a python base image.
  // The TS signature over-constrains to CreateSandboxFromImageParams (image required),
  // so we cast through unknown. language: 'typescript' gives us bun in the sandbox.
  const createParams = {
    language: 'typescript',
    autoDeleteInterval: 30,
    envVars: { OPENROUTER_API_KEY: env.OPENROUTER_API_KEY, YDC_API_KEY: env.YDC_API_KEY },
    ...(name !== undefined && { name }),
  } as unknown as Parameters<typeof daytona.create>[0]
  const sandbox = await daytona.create(createParams)

  // Clone the repo (public, no auth).
  await sandbox.git.clone(REPO_URL, REPO_PATH, 'dev', undefined, undefined, undefined, undefined, 1)

  // Install deps — the gate needs ajv (seconds, not minutes).
  // MINIMAL: bun install per run. Upgrade path: bake a Daytona snapshot with deps
  // pre-installed, then fork from it for instant candidates.
  await sandbox.process.executeCommand('bun install', REPO_PATH, undefined, 120)

  return sandbox
}

/**
 * Create a Daytona sandbox from a VM-class snapshot (required for fork).
 * Same flow as {@link setupSandbox} but uses a pre-built linux-vm snapshot.
 *
 * @public
 */
export const setupVMSandbox = async (env: WrapperEnv, name?: string): Promise<Sandbox> => {
  const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })

  if (name !== undefined) {
    await deleteExistingSandbox(daytona, name)
  }

  const createParams = {
    language: 'typescript',
    snapshot: VM_SNAPSHOT,
    autoDeleteInterval: 30,
    envVars: { OPENROUTER_API_KEY: env.OPENROUTER_API_KEY, YDC_API_KEY: env.YDC_API_KEY },
    ...(name !== undefined && { name }),
  } as unknown as Parameters<typeof daytona.create>[0]
  const sandbox = await daytona.create(createParams)

  // Clone the repo (public, no auth).
  await sandbox.git.clone(REPO_URL, REPO_PATH, 'dev', undefined, undefined, undefined, undefined, 1)

  // Install deps.
  await sandbox.process.executeCommand('bun install', REPO_PATH, undefined, 120)

  return sandbox
}

// ---------------------------------------------------------------------------
// promoteHostSide — write the candidate host-side (no GitHub token in sandbox)
// ---------------------------------------------------------------------------

/**
 * Promote a candidate host-side. The sandbox verifies; the host commits.
 *
 * MINIMAL: logs the promoted candidate. A full implementation would git add +
 * commit the candidate to `src/kernel/threads.ts`. The live demo proves the
 * gate works; the host-side commit is the promote callback's job.
 *
 * @public
 */
export const promoteHostSide = async (candidate: Thread): Promise<void> => {
  console.log(`[promote] Promoted candidate: ${candidate.label} (${candidate.rules.length} rules)`)
}

// ---------------------------------------------------------------------------
// runScriptedDemo — the deterministic safe demo
// ---------------------------------------------------------------------------

/**
 * Run the scripted autoresearch loop in a Daytona sandbox.
 *
 * The generator returns the known-good progressive-disclosure thread (the
 * "correction"). The gate runs in the sandbox. On pass, the host promotes.
 *
 * @public
 */
export const runScriptedDemo = async (verbose = false): Promise<void> => {
  const env = readEnv()
  console.log('[demo:autoresearch] Creating Daytona sandbox...')
  const sandbox = await setupSandbox(env, 'autoresearch-demo')
  console.log(`[demo:autoresearch] Sandbox ready: ${sandbox.id}`)

  try {
    const gate = createSandboxGate(sandbox)

    const brokenThread: Thread = {
      label: 'progressive-disclosure-broken',
      once: true,
      rules: [
        { waitFor: [{ type: 'user.prompt' }] },
        { request: { type: 'model.respond' } },
        { waitFor: [{ type: 'model.result' }], interrupt: [{ type: 'turn.end' }] },
        { request: { type: 'skill.read' } },
        { waitFor: [{ type: 'tool.loaded' }], interrupt: [{ type: 'turn.end' }] },
        { request: { type: 'turn.end' } },
      ],
    }

    const config: LoopConfig = {
      currentThread: brokenThread,
      triggers: GATE_TRIGGERS,
      maxDepth: MAX_DEPTH,
      space: SPACE,
      maxIterations: MAX_ITERATIONS,
      generator: async () => PROGRESSIVE_DISCLOSURE_THREAD,
      promote: promoteHostSide,
      gate,
    }

    console.log('[demo:autoresearch] Running loop in sandbox...')
    const result = await runAutoresearchLoop(config)

    console.log(formatStory(result, 'demo:autoresearch', brokenThread))
    if (verbose) {
      console.log(serializeResultsLog(result))
    }

    const promoted = result.iterations.find((i) => i.kept)
    if (promoted) {
      console.log(`[demo:autoresearch] Promoted candidate: ${promoted.candidate.label}`)
    } else {
      console.log('[demo:autoresearch] No candidate passed the gate.')
    }
  } finally {
    const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })
    await daytona.delete(sandbox)
    console.log('[demo:autoresearch] Sandbox deleted.')
  }
}

// ---------------------------------------------------------------------------
// runModelDemo — GLM host-side generator, gate in sandbox
// ---------------------------------------------------------------------------

/**
 * Run the model-generator autoresearch loop. GLM generates the candidate
 * host-side (reliable); the gate runs in the sandbox.
 *
 * @public
 */
export const runModelDemo = async (verbose = false): Promise<void> => {
  const env = readEnv()
  console.log('[demo:autoresearch:model] Creating Daytona sandbox...')
  const sandbox = await setupSandbox(env, 'autoresearch-model-demo')
  console.log(`[demo:autoresearch:model] Sandbox ready: ${sandbox.id}`)

  try {
    const gate = createSandboxGate(sandbox)

    // Model tools — GLM via OpenRouter, host-side.
    const { modelRespond } = createModelTools({
      endpoints: {
        openrouter: {
          url: 'https://openrouter.ai/api/v1',
          apiKey: env.OPENROUTER_API_KEY,
        },
      },
    })

    const generator = createModelGenerator({
      modelRespond,
      provider: 'openrouter',
      modelId: 'z-ai/glm-5.3-flash',
      instructions:
        'You are a behavioral thread optimizer. Generate an improved version of the thread as a full replacement Thread JSON object.',
      reasoningEffort: 'medium',
    })

    const brokenThread: Thread = {
      label: 'progressive-disclosure-broken',
      once: true,
      rules: [
        { waitFor: [{ type: 'user.prompt' }] },
        { request: { type: 'model.respond' } },
        { waitFor: [{ type: 'model.result' }], interrupt: [{ type: 'turn.end' }] },
        { request: { type: 'skill.read' } },
        { waitFor: [{ type: 'tool.loaded' }], interrupt: [{ type: 'turn.end' }] },
        { request: { type: 'turn.end' } },
      ],
    }

    const config: LoopConfig = {
      currentThread: brokenThread,
      triggers: GATE_TRIGGERS,
      maxDepth: MAX_DEPTH,
      space: SPACE,
      maxIterations: MAX_ITERATIONS,
      generator,
      promote: promoteHostSide,
      gate,
    }

    console.log('[demo:autoresearch:model] Running model loop...')
    const result = await runAutoresearchLoop(config)

    console.log(formatStory(result, 'demo:autoresearch:model', brokenThread))
    if (verbose) {
      console.log(serializeResultsLog(result))
    }

    const promoted = result.iterations.find((i) => i.kept)
    if (promoted) {
      console.log(`[demo:autoresearch:model] Promoted candidate: ${promoted.candidate.label}`)
    } else {
      console.log('[demo:autoresearch:model] No candidate passed the gate.')
    }
  } finally {
    const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })
    await daytona.delete(sandbox)
    console.log('[demo:autoresearch:model] Sandbox deleted.')
  }
}

// ---------------------------------------------------------------------------
// runForkIsolationBeat — the Daytona-event money shot
// ---------------------------------------------------------------------------

/**
 * The fork-isolation beat: run the baseline in a parent sandbox, fork a child,
 * run a broken candidate in the child (it gate-fails), then show the parent's
 * filesystem/thread is untouched.
 *
 * Demonstrates: "self-modification can't break confluence" on Daytona's platform.
 *
 * @remarks
 * Forking requires a linux-vm class sandbox. If the current region has VM runners,
 * the beat uses a real fork. If not (e.g. container-only region), it falls back to
 * two independent sandboxes — same isolation guarantee, different mechanism.
 *
 * @public
 */
export const runForkIsolationBeat = async (verbose = false): Promise<void> => {
  const env = readEnv()
  const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })

  // Try VM-class fork first; fall back to container isolation if no VM runners.
  const canFork = await tryForkIsolationBeat(env, daytona, verbose)
  if (canFork) return

  console.log('[fork-isolation] No VM runners — using two-sandbox isolation beat...')
  await twoSandboxIsolationBeat(env, daytona, verbose)
}

/**
 * Try the real fork beat with a VM sandbox. Returns true on success, false if
 * VM runners are unavailable.
 */
const tryForkIsolationBeat = async (env: WrapperEnv, daytona: Daytona, verbose = false): Promise<boolean> => {
  let parent: Sandbox | null = null
  try {
    console.log('[fork-isolation] Creating parent sandbox (linux-vm for fork support)...')
    parent = await setupVMSandbox(env, 'autoresearch-parent')
  } catch (e) {
    console.log(`[fork-isolation] VM sandbox unavailable: ${(e as Error).message.split('\n')[0]}`)
    return false
  }

  try {
    await parent.fs.uploadFile(Buffer.from('parent-clean'), '/tmp/sentinel.txt')
    console.log(`[fork-isolation] Parent sandbox ready: ${parent.id}`)

    console.log('[fork-isolation] Forking child...')
    const child = await daytona.fork(parent)
    console.log(`[fork-isolation] Child forked: ${child.id}`)

    try {
      const brokenThread: Thread = {
        label: 'progressive-disclosure-broken',
        once: true,
        rules: [
          { waitFor: [{ type: 'user.prompt' }] },
          { request: { type: 'model.respond' } },
          { waitFor: [{ type: 'model.result' }], interrupt: [{ type: 'turn.end' }] },
          { request: { type: 'skill.read' } },
          { waitFor: [{ type: 'tool.loaded' }], interrupt: [{ type: 'turn.end' }] },
          { request: { type: 'turn.end' } },
        ],
      }

      const childGate = createSandboxGate(child)
      console.log('[fork-isolation] Running broken candidate in child...')
      const gateResult = await childGate({
        candidate: brokenThread,
        triggers: GATE_TRIGGERS,
        maxDepth: MAX_DEPTH,
        space: SPACE,
      })

      console.log(
        formatStory(
          {
            iterations: [
              {
                iteration: 0,
                candidate: brokenThread,
                verifyStatus: gateResult.verifyStatus,
                targetReached: gateResult.targetReached,
                kept: gateResult.kept,
                trace: gateResult.trace,
              },
            ],
          },
          'fork-isolation',
          brokenThread,
        ),
      )

      // Corrupt the child's sentinel — simulates a risky self-modification.
      await child.fs.uploadFile(Buffer.from('child-corrupted'), '/tmp/sentinel.txt')

      // Check the parent — it must be untouched.
      const parentSentinel = await parent.fs.downloadFile('/tmp/sentinel.txt')
      const parentContent = Buffer.from(parentSentinel).toString('utf8')

      console.log(`[fork-isolation] Parent sentinel: "${parentContent}"`)
      if (parentContent === 'parent-clean') {
        console.log('[fork-isolation] \u2713 Parent untouched — fork isolation confirmed!')
      } else {
        console.error('[fork-isolation] \u2717 Parent corrupted — fork isolation FAILED!')
        throw new Error('Fork isolation failed: parent was modified')
      }
    } finally {
      await daytona.delete(child)
      console.log('[fork-isolation] Child deleted.')
    }
  } finally {
    await daytona.delete(parent)
    console.log('[fork-isolation] Parent deleted.')
  }
  return true
}

/**
 * Two-sandbox isolation beat: create a parent and a child sandbox independently
 * (not via fork). The child runs a broken candidate and corrupts its own
 * filesystem; the parent stays clean. Same isolation guarantee — independent
 * sandboxes can't touch each other's filesystem.
 */
const twoSandboxIsolationBeat = async (env: WrapperEnv, daytona: Daytona, verbose = false): Promise<void> => {
  console.log('[fork-isolation] Creating parent sandbox...')
  const parent = await setupSandbox(env, 'autoresearch-parent')

  try {
    await parent.fs.uploadFile(Buffer.from('parent-clean'), '/tmp/sentinel.txt')
    console.log(`[fork-isolation] Parent sandbox ready: ${parent.id}`)

    console.log('[fork-isolation] Creating child sandbox (independent, not forked)...')
    const child = await setupSandbox(env, 'autoresearch-child')

    try {
      const brokenThread: Thread = {
        label: 'progressive-disclosure-broken',
        once: true,
        rules: [
          { waitFor: [{ type: 'user.prompt' }] },
          { request: { type: 'model.respond' } },
          { waitFor: [{ type: 'model.result' }], interrupt: [{ type: 'turn.end' }] },
          { request: { type: 'skill.read' } },
          { waitFor: [{ type: 'tool.loaded' }], interrupt: [{ type: 'turn.end' }] },
          { request: { type: 'turn.end' } },
        ],
      }

      const childGate = createSandboxGate(child)
      console.log('[fork-isolation] Running broken candidate in child...')
      const gateResult = await childGate({
        candidate: brokenThread,
        triggers: GATE_TRIGGERS,
        maxDepth: MAX_DEPTH,
        space: SPACE,
      })

      console.log(
        formatStory(
          {
            iterations: [
              {
                iteration: 0,
                candidate: brokenThread,
                verifyStatus: gateResult.verifyStatus,
                targetReached: gateResult.targetReached,
                kept: gateResult.kept,
                trace: gateResult.trace,
              },
            ],
          },
          'fork-isolation',
          brokenThread,
        ),
      )

      // Corrupt the child's sentinel — simulates a risky self-modification.
      await child.fs.uploadFile(Buffer.from('child-corrupted'), '/tmp/sentinel.txt')
      console.log('[fork-isolation] Child sentinel corrupted (risky modification).')

      // Check the parent — it must be untouched (independent sandboxes).
      const parentSentinel = await parent.fs.downloadFile('/tmp/sentinel.txt')
      const parentContent = Buffer.from(parentSentinel).toString('utf8')

      console.log(`[fork-isolation] Parent sentinel: "${parentContent}"`)
      if (parentContent === 'parent-clean') {
        console.log('[fork-isolation] \u2713 Parent untouched — sandbox isolation confirmed!')
      } else {
        console.error('[fork-isolation] \u2717 Parent corrupted — isolation FAILED!')
        throw new Error('Isolation failed: parent was modified')
      }
    } finally {
      await daytona.delete(child)
      console.log('[fork-isolation] Child deleted.')
    }
  } finally {
    await daytona.delete(parent)
    console.log('[fork-isolation] Parent deleted.')
  }
}

// ---------------------------------------------------------------------------
// CLI entry point - only runs when executed directly, not when imported by tests
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2)
  const verbose = args.includes('--verbose') || args.includes('--trace')
  if (args.includes('--fork-isolation')) {
    await runForkIsolationBeat(verbose)
  } else if (args.includes('--model')) {
    await runModelDemo(verbose)
  } else {
    await runScriptedDemo(verbose)
  }
}
