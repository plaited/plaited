/**
 * Claude Code trial adapter — spawns `claude -p` with workspace isolation
 * and rich trajectory capture for module generation evaluation.
 *
 * @remarks
 * Loaded by the trial runner via `loadAdapter('src/tools/adapters/claude-code.ts')`.
 * The `adapt` named export satisfies the Adapter contract.
 *
 * @packageDocumentation
 */

import type { Adapter, AdapterResult, TrajectoryStep } from '../trial.schemas.ts'

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
       "contentType": "<domain>",
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

For any UI rendering, use the plaited template system:
- Import \`{ h, Fragment }\` from the template module for JSX-like HTML generation
- Use \`createSSR()\` for server-side rendering
- Templates use \`h('tag', { attrs }, ...children)\` syntax
- Use \`p-trigger\` attribute for event binding, \`p-target\` for element targeting
- CSS: use style objects, not CSS strings

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
		'--output-format', 'stream-json',
		'--max-turns', '50',
		'--append-system-prompt', MODULE_SYSTEM_PROMPT,
		text,
	]

	const proc = Bun.spawn(args, {
		cwd: cwd ?? process.cwd(),
		stdout: 'pipe',
		stderr: 'pipe',
	})

	const raw = await new Response(proc.stdout).text()
	const exitCode = await proc.exited
	const elapsed = Date.now() - start

	// Parse NDJSON events
	const events = raw.trim().split('\n').filter(Boolean).map((line) => {
		try { return JSON.parse(line) as Record<string, unknown> }
		catch { return null }
	}).filter((e): e is Record<string, unknown> => e !== null)

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
						name: block.name as string ?? 'unknown',
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
					const toolCallId = block.tool_use_id as string | undefined
					const isError = block.is_error as boolean | undefined
					const resultContent = typeof block.content === 'string'
						? block.content
						: JSON.stringify(block.content)

					const pendingCall = [...trajectory].reverse().find(
						(s) => s.type === 'tool_call' && s.status === 'pending',
					)
					if (pendingCall && pendingCall.type === 'tool_call') {
						pendingCall.status = isError ? 'failed' : 'completed'
						pendingCall.output = resultContent
					}
				}
			}
			continue
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
