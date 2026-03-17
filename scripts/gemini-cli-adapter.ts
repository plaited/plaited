/**
 * Gemini CLI trial adapter — spawns `gemini -p --yolo` for headless module generation.
 *
 * @remarks
 * Loaded by the trial runner via `loadAdapter('scripts/gemini-cli-adapter.ts')`.
 * The `adapt` named export satisfies the Adapter contract.
 *
 * Requires Gemini CLI to be installed (`npm install -g @google/gemini-cli`) and
 * authenticated (`gemini auth`). Uses `--yolo` to auto-approve all tool actions
 * and `--output-format stream-json` for structured event parsing.
 *
 * @packageDocumentation
 */

import type { Adapter, TrajectoryStep } from '../src/tools/trial.schemas.ts'

// ============================================================================
// Module Generation System Prompt (matches claude-code-adapter conventions)
// ============================================================================

const MODULE_SYSTEM_PROMPT = `You are generating a modnet module. Create a complete, working module in the current directory.

## Required Structure

1. **package.json** — Must include a "modnet" field with MSS bridge-code tags:
   \`\`\`json
   {
     "name": "@node/<module-name>",
     "version": "1.0.0",
     "modnet": {
       "contentType": "<see canonical list below>",
       "structure": "<list|collection|form|feed|stream|thread|object|steps>",
       "mechanics": ["<sort|filter|track|chart|post|like|follow|share|reply|vote>"],
       "boundary": "<all|none|ask|paid>",
       "scale": <1-4>
     }
   }
   \`\`\`

2. **skills/<module-name>/SKILL.md** — Seed skill with frontmatter:
   \`\`\`yaml
   ---
   name: <module-name>
   description: <one-line description>
   metadata:
     contentType: <same as package.json>
     structure: <same as package.json>
     boundary: <same as package.json>
     scale: "<number>"
   ---
   \`\`\`
   Then a markdown body describing what the module does and how to use it.

3. **TypeScript source files** — Implementation code as .ts files.

4. **data/ directory** — For persistent data storage (JSON or JSONL format).

## MSS Tag Rules
**contentType** — use EXACTLY these canonical values:
health, social, science, finance, logistics, tools, art,
entertainment, education, geo, weather, news, commerce, produce
- Charts/stats/simulation → \`science\` (not data-viz)
- Color tools/design → \`art\` (not design)
- Calendars/scheduling → \`tools\` (not productivity)
- Drawing/portfolio → \`art\` (not drawing/portfolio)
- Recipes/food items → \`produce\` (not health; health is for fitness/medical tracking)

**boundary** — match the sharing model:
- \`none\`: personal data user wouldn't share (health, finance, playlists, drawings, notes)
- \`ask\`: social/collaborative data user might share (chat, social feeds, inventories)
- \`all\`: public content or stateless tools (forums, converters, calculators, weather, charts)

**structure** — choose by information pattern:
- \`object\`: single display item
- \`list\`: ordered sequences (playlists, reading lists)
- \`collection\`: unordered groups browsed by filter/search
- \`form\`: creation/generation tools (editors, calculators, chart generators)
- \`steps\`: multi-page flows with distinct screens/modes
- \`stream\`: chronological messages (chat rooms)
- \`thread\`: nested replies (forums)
- \`feed\`: algorithm-sorted (social feeds)

## Rules
- Write ALL files to the current working directory
- Do NOT create test files (.spec.ts)
- Do NOT install dependencies (just declare them in package.json)
- Use TypeScript with strict types
- Use arrow functions (\`const fn = () => ...\`) not function declarations
- Use \`type\` not \`interface\`
`

// ============================================================================
// Adapter
// ============================================================================

/**
 * Gemini CLI adapter for the trial runner.
 *
 * @remarks
 * Spawns `gemini -p --yolo --output-format stream-json` for automated
 * file generation. The system prompt is passed via `--system-prompt`.
 *
 * The working directory is set via `Bun.spawn({ cwd })`.
 *
 * @public
 */
export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()

  const fullPrompt = `${MODULE_SYSTEM_PROMPT}\n\n---\n\nTask: ${text}`

  const args = [
    'gemini',
    '-p',
    fullPrompt,
    '--yolo',
    '--output-format',
    'stream-json',
  ]

  // Strip session keys from env so subprocess uses system gemini credentials
  const { ANTHROPIC_API_KEY: _, CLAUDE_CODE_ENTRYPOINT: __, CLAUDECODE: ___, ...spawnEnv } = process.env

  const proc = Bun.spawn(args, {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    stderr: 'ignore',
    env: spawnEnv as Record<string, string>,
  })

  const [raw, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  const elapsed = Date.now() - start

  // Parse NDJSON events from Gemini CLI stream-json format
  const events = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>
      } catch {
        return null
      }
    })
    .filter((e): e is Record<string, unknown> => e !== null)

  const trajectory: TrajectoryStep[] = []
  let output = ''

  for (const event of events) {
    const ts = Date.now()

    // Gemini CLI stream-json event shapes:
    // { type: 'response', delta: { text: '...' } }   — text chunk
    // { type: 'final_response', text: '...' }         — final result
    // { type: 'tool_call', name: '...', args: {...} } — tool invocation
    // { type: 'tool_result', name: '...', result: {...} } — tool output
    // { type: 'done' }                                — stream complete
    // Fallback: { content: '...' } or { text: '...' } — raw text

    if (event.type === 'final_response') {
      const text = event.text ?? event.content ?? event.result
      if (typeof text === 'string') output = text
      continue
    }

    if (event.type === 'response') {
      const delta = event.delta as Record<string, unknown> | undefined
      const text = delta?.text ?? delta?.content
      if (typeof text === 'string') {
        output += text
        trajectory.push({ type: 'message', content: text, timestamp: ts })
      }
      continue
    }

    if (event.type === 'tool_call') {
      trajectory.push({
        type: 'tool_call',
        name: (event.name as string) ?? (event.tool_name as string) ?? 'unknown',
        status: 'pending',
        input: event.args ?? event.input ?? event.parameters,
        timestamp: ts,
      })
      continue
    }

    if (event.type === 'tool_result' || event.type === 'tool_response') {
      const pendingCall = [...trajectory].reverse().find((s) => s.type === 'tool_call' && s.status === 'pending')
      if (pendingCall && pendingCall.type === 'tool_call') {
        const isError = !!(event.error)
        pendingCall.status = isError ? 'failed' : 'completed'
        pendingCall.output = JSON.stringify(event.result ?? event.output ?? event.content)
      }
      continue
    }

    // Fallback: if the event has plain text fields, capture as message
    const plainText = event.text ?? event.content
    if (typeof plainText === 'string' && plainText.trim()) {
      output = plainText
    }
  }

  // If we got no structured output, treat the whole raw output as text (--output-format text fallback)
  if (!output && raw.trim() && exitCode === 0) {
    output = raw.trim()
  }

  return {
    output,
    trajectory: trajectory.length > 0 ? trajectory : undefined,
    timing: { total: elapsed },
    exitCode,
    timedOut: exitCode === 124,
  }
}
