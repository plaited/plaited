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
  runAutoresearchLoop,
  serializeResultsLog,
} from '../../src/kernel/autoresearch.ts'
import { PROGRESSIVE_DISCLOSURE_THREAD } from '../../src/kernel/threads.ts'
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
export const runScriptedDemo = async (): Promise<void> => {
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

    console.log('[demo:autoresearch] Results:')
    console.log(serializeResultsLog(result))

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
export const runModelDemo = async (): Promise<void> => {
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

    console.log('[demo:autoresearch:model] Results:')
    console.log(serializeResultsLog(result))

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
export const runForkIsolationBeat = async (): Promise<void> => {
  const env = readEnv()
  const daytona = new Daytona({ apiKey: env.DAYTONA_API_KEY })

  // Try VM-class fork first; fall back to container isolation if no VM runners.
  const canFork = await tryForkIsolationBeat(env, daytona)
  if (canFork) return

  console.log('[fork-isolation] No VM runners — using two-sandbox isolation beat...')
  await twoSandboxIsolationBeat(env, daytona)
}

/**
 * Try the real fork beat with a VM sandbox. Returns true on success, false if
 * VM runners are unavailable.
 */
const tryForkIsolationBeat = async (env: WrapperEnv, daytona: Daytona): Promise<boolean> => {
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

      console.log(`[fork-isolation] Child gate: kept=${gateResult.kept}, targetReached=${gateResult.targetReached}`)

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
const twoSandboxIsolationBeat = async (env: WrapperEnv, daytona: Daytona): Promise<void> => {
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

      console.log(`[fork-isolation] Child gate: kept=${gateResult.kept}, targetReached=${gateResult.targetReached}`)

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
  const mode = process.argv[2] ?? 'scripted'
  if (mode === '--fork-isolation') {
    await runForkIsolationBeat()
  } else if (mode === '--model') {
    await runModelDemo()
  } else {
    await runScriptedDemo()
  }
}
