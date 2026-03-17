/**
 * Claude Code trial adapter — spawns `claude -p` with workspace isolation
 * and rich trajectory capture for module generation evaluation.
 *
 * @remarks
 * Loaded by the trial runner via `loadAdapter('scripts/claude-code-adapter.ts')`.
 * The `adapt` named export satisfies the Adapter contract.
 *
 * @packageDocumentation
 */

import type { Adapter, TrajectoryStep } from '../src/tools/trial.schemas.ts'

// ============================================================================
// Module Generation System Prompt (appended to Claude Code defaults)
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

## UI Library

For UI rendering, use whichever HTML generation approach you prefer:
- **Option A (simple)**: Return an HTML string directly with template literals
- **Option B (plaited)**: Use \`import { h, Fragment, createSSR } from 'plaited'\`
  - h(tag, attrs) — EXACTLY 2 args; children go as \`{ children: [...] }\` inside attrs
  - h('div', { class: 'x', children: [h('span', { children: ['text'] })] })
  - style must be an object: \`{ style: { backgroundColor: 'blue' } }\` NOT \`{ style: 'color: red' }\`
- Prefer Option A (HTML strings) unless you specifically need the plaited SSR system
- Example Option A: \`const renderPage = (data: MyData): string => \`<div>\${data.title}</div>\`\`
- Use \`p-trigger\` attribute for event binding, \`p-target\` for element targeting
- CSS: use style objects, not CSS strings

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
- \`all\`: public content or stateless tools (forums, converters, calculators, weather, periodic table, charts, portfolio galleries — anything designed to be publicly viewed)

**structure** — choose by information pattern:
- \`object\`: single display item (weather reading, color palette, one artwork)
- \`list\`: strictly ordered sequences where ORDER IS THE POINT — playlists (track order matters), reading lists (reading order matters), meal/food logs (chronological append-only records with timestamps). Use ONLY when ordering is a core feature.
- \`collection\`: unordered groups browsed by category, filter, or search — portfolios, inventories, expense records, crypto portfolios, code snippet libraries, quiz banks, recipe collections, habit records, map marker collections, geographic datasets (no inherent sequence; user filters/searches to explore)
- \`form\`: CREATION or GENERATION tools where the primary action is producing output — editors (markdown, code), calculators, chart generators, color palette generators (the user creates something; the main flow is input→generate→output)
- \`steps\`: multi-page flow with distinct screens/modes — habit trackers with day/week/month view tabs, quiz builders with multi-step question flow, calendar day/month views, wizards, multi-mode simulators (explicit navigation between different views of the same data)
- \`stream\`: chronological messages (chat rooms — time-ordered, append-only)
- \`thread\`: nested replies (forums, Reddit — hierarchical discussion)
- \`feed\`: algorithm-sorted (social feeds — ranked by relevance)

## Common Dependencies

Always declare these in package.json when relevant:
- Map modules: \`"leaflet": "^1"\` and \`"@types/leaflet": "^1"\` (do NOT use Google Maps or Mapbox inline API)
- Chart modules: \`"chart.js": "^4"\` (unless building SVG charts from scratch, which is preferred)
- Markdown: \`"marked": "^12"\` for parsing

## Large Data Sets

For modules requiring large static datasets (e.g., periodic table elements, world countries, currencies, emoji lists):
- Write the data as a **JSON file** in \`data/<name>.json\` — do NOT hardcode as TypeScript constants
- Keep TypeScript source files thin: just load the JSON with \`Bun.file('data/<name>.json').json()\`
- This keeps TypeScript files short and avoids running out of time writing inline data

## TypeScript Patterns (avoid tsc errors)

These patterns prevent the most common TypeScript strict-mode errors in generated code:

**Typed array literals** — always annotate empty arrays:
\`\`\`ts
// ✗ TypeScript infers never[] or can't infer element type
const items = []
// ✓
const items: Item[] = []
\`\`\`

**Typed null/undefined variables** — annotate mutable nullable vars:
\`\`\`ts
// ✗ TypeScript infers type 'null', can't reassign to MyType
let result = null
// ✓
let result: MyType | null = null
\`\`\`

**Optional parameter guards** — use optional chaining + nullish coalescing:
\`\`\`ts
// ✗ TypeScript strict: 'params.genre' is possibly undefined
data.filter(item => item.genre === params.genre)
// ✓
data.filter(item => item.genre === (params.genre ?? ''))
\`\`\`

**Binary data in fetch** — use Uint8Array not Buffer (Buffer isn't BodyInit):
\`\`\`ts
// ✗ Buffer<ArrayBufferLike> not assignable to BodyInit
fetch(url, { method: 'POST', body: buffer })
// ✓ Use Bun.write for file I/O, or convert to Uint8Array for fetch
await Bun.write(path, buffer)
\`\`\`

## Rules
- Write ALL files to the current working directory
- Do NOT create test files (.spec.ts)
- Do NOT install dependencies (just declare them in package.json)
- Use TypeScript with strict types
- Use arrow functions (\`const fn = () => ...\`) not function declarations
- Use \`type\` not \`interface\`
- Prefer Bun APIs over Node.js APIs (Bun.file, Bun.write, Bun.$)
`

// ============================================================================
// Adapter
// ============================================================================

/**
 * Claude Code adapter for the trial runner.
 *
 * @remarks
 * Spawns `claude -p` with `--dangerously-skip-permissions` for automated
 * file generation, `--append-system-prompt` for module conventions, and
 * `--output-format stream-json` for structured event parsing.
 *
 * The prompt is passed as a positional argument. The working directory
 * is set via `Bun.spawn({ cwd })` — Claude Code has no `--cwd` flag.
 *
 * @public
 */
export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()

  const args = [
    'claude',
    '-p',
    '--dangerously-skip-permissions',
    '--verbose',
    '--output-format',
    'stream-json',
    '--max-turns',
    '50',
    '--append-system-prompt',
    MODULE_SYSTEM_PROMPT,
    text,
  ]

  // Strip session-scoped keys from env so the subprocess uses ~/.claude/ OAuth
  // credentials instead of the parent session's temp ANTHROPIC_API_KEY (which
  // expires after heavy usage and causes 401s in long eval runs).
  const { ANTHROPIC_API_KEY: _, CLAUDE_CODE_ENTRYPOINT: __, CLAUDECODE: ___, ...spawnEnv } = process.env

  const proc = Bun.spawn(args, {
    cwd: cwd ?? process.cwd(),
    stdout: 'pipe',
    // stderr: 'ignore' — piping but not draining stderr keeps the Bun process alive
    // after the subprocess exits (stream ref stays open). Ignore discards cleanly.
    stderr: 'ignore',
    env: spawnEnv as Record<string, string>,
  })

  const [raw, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  const elapsed = Date.now() - start

  // Parse NDJSON events
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

  // Build trajectory and extract output
  const trajectory: TrajectoryStep[] = []
  let output = ''
  let inputTokens = 0
  let outputTokens = 0

  for (const event of events) {
    const ts = Date.now()

    // Result event — final output and token usage
    if (event.type === 'result') {
      if (typeof event.result === 'string') output = event.result
      const usage = event.usage as Record<string, number> | undefined
      if (usage) {
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
      }
      continue
    }

    // Assistant message — contains text, thinking, tool_use blocks
    if (event.type === 'assistant') {
      const msg = event.message as Record<string, unknown> | undefined
      const content = msg?.content as Array<Record<string, unknown>> | undefined
      if (!content) continue

      for (const block of content) {
        if (block.type === 'thinking' && typeof block.thinking === 'string') {
          trajectory.push({ type: 'thought', content: block.thinking, timestamp: ts })
        }
        if (block.type === 'text' && typeof block.text === 'string') {
          trajectory.push({ type: 'message', content: block.text, timestamp: ts })
        }
        if (block.type === 'tool_use') {
          trajectory.push({
            type: 'tool_call',
            name: (block.name as string) ?? 'unknown',
            status: 'pending',
            input: block.input,
            timestamp: ts,
          })
        }
      }

      // Accumulate usage from per-turn messages
      const usage = msg?.usage as Record<string, number> | undefined
      if (usage) {
        inputTokens += usage.input_tokens ?? 0
        outputTokens += usage.output_tokens ?? 0
      }
      continue
    }

    // Tool result events
    if (event.type === 'user') {
      const msg = event.message as Record<string, unknown> | undefined
      const content = msg?.content as Array<Record<string, unknown>> | undefined
      if (!content) continue

      for (const block of content) {
        if (block.type === 'tool_result') {
          // Find matching pending tool_call and update it
          const _toolCallId = block.tool_use_id as string | undefined
          const isError = block.is_error as boolean | undefined
          const resultContent = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)

          const pendingCall = [...trajectory].reverse().find((s) => s.type === 'tool_call' && s.status === 'pending')
          if (pendingCall && pendingCall.type === 'tool_call') {
            pendingCall.status = isError ? 'failed' : 'completed'
            pendingCall.output = resultContent
          }
        }
      }
    }
  }

  return {
    output: output || '',
    trajectory: trajectory.length > 0 ? trajectory : undefined,
    timing: {
      total: elapsed,
      ...(inputTokens > 0 && { inputTokens }),
      ...(outputTokens > 0 && { outputTokens }),
    },
    exitCode,
    timedOut: exitCode === 124,
  }
}
