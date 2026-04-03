---
name: trial-adapters
description: Write adapter scripts for `src/improve` and the improve CLI. Adapters wrap Pi, Plaited-native agents, or external agents behind the stdin/stdout JSON contract and can capture rich trajectory evidence.
license: ISC
---

# Trial Adapters

## Purpose

Write adapter scripts that expose an execution surface to `src/improve`. Adapters
follow the polyglot pattern: TypeScript modules or executables with stdin/stdout
JSON.

**Use this when:**
- Exposing Pi, Plaited-native, or external execution to `runTrial()`
- Creating adapters for different evaluation configurations
- Building adapters that capture rich trajectory data
- Integrating external tools or agent runtimes into the public improve surface

This skill is a reusable integration surface. It is not the center of
Plaited's broader improvement workflow.

## Adapter Contract

### TypeScript Module

Export an `adapt` function matching the `Adapter` type:

```typescript
import type { Adapter } from './src/improve.ts'

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const proc = Bun.spawn(['my-agent', '--prompt', text], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  return { output: output.trim(), exitCode }
}
```

### Executable Script

Any executable — reads `AdapterInput` from stdin, writes `AdapterResult` to stdout:

```python
#!/usr/bin/env python3
import json, sys, subprocess

data = json.load(sys.stdin)
prompt = data["prompt"]
cwd = data.get("cwd")

result = subprocess.run(
    ["my-agent", prompt],
    capture_output=True, text=True, cwd=cwd
)

print(json.dumps({
    "output": result.stdout.strip(),
    "exitCode": result.returncode
}))
```

### Input Type

```typescript
type AdapterInput = {
  prompt: string | string[]  // Single or multi-turn
  cwd?: string               // Working directory
}
```

### Output Type

```typescript
type AdapterResult = {
  output: string                   // Final agent response (required)
  trajectory?: TrajectoryStep[]    // Optional structured trajectory
  timing?: {
    total?: number                 // Adapter-measured duration (ms)
    inputTokens?: number           // Input tokens consumed
    outputTokens?: number          // Output tokens generated
  }
  exitCode?: number | null         // Process exit code (null if signaled)
  timedOut?: boolean               // Whether the adapter timed out
}
```

## Loading

`src/improve` loads adapters via `loadAdapter()`:

```typescript
import { loadAdapter } from './src/improve.ts'

// TS module: imports and extracts 'adapt' export
const adapter = await loadAdapter('./my-adapter.ts')

// Executable: wraps as stdin/stdout JSON subprocess
const adapter = await loadAdapter('./my-adapter.py')
```

Detection is by file extension: `.ts`, `.js`, `.mjs`, `.cjs` are imported as ES modules. Everything else is spawned as a subprocess.

## Patterns

### Minimal Adapter (Output Only)

Simplest possible adapter — just captures text output:

```typescript
import type { Adapter } from './src/improve.ts'

export const adapt: Adapter = async ({ prompt }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const result = await Bun.$`echo ${text} | my-agent`.text()
  return { output: result.trim() }
}
```

### Rich Adapter (Trajectory + Timing)

Captures structured trajectory for detailed analysis and downstream scoring:

```typescript
import type { Adapter } from './src/improve.ts'
import type { TrajectoryStep } from './src/agent/agent.schemas.ts'

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()

  const proc = Bun.spawn(
    ['my-agent', '--prompt', text, '--output-format', 'json'],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  )

  const raw = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  const elapsed = Date.now() - start

  // Parse agent's JSON output into trajectory
  const events = raw.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  const trajectory: TrajectoryStep[] = []
  let output = ''

  for (const event of events) {
    if (event.type === 'thinking') {
      trajectory.push({ type: 'thought', content: event.text, timestamp: Date.now() })
    } else if (event.type === 'tool_use') {
      trajectory.push({
        type: 'tool_call',
        name: event.name,
        status: 'completed',
        input: event.input,
        output: event.result,
        timestamp: Date.now(),
      })
    } else if (event.type === 'text') {
      output += event.text
      trajectory.push({ type: 'message', content: event.text, timestamp: Date.now() })
    }
  }

  return {
    output,
    trajectory,
    timing: {
      total: elapsed,
      inputTokens: events.find((e) => e.usage)?.usage?.input_tokens,
      outputTokens: events.find((e) => e.usage)?.usage?.output_tokens,
    },
    exitCode,
  }
}
```

### Multi-Turn Adapter

Handles `prompt: string[]` by sending each turn sequentially:

```typescript
import type { Adapter } from './src/improve.ts'

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const turns = Array.isArray(prompt) ? prompt : [prompt]
  const outputs: string[] = []

  for (const turn of turns) {
    const result = await Bun.$`my-agent --prompt ${turn} --cwd ${cwd ?? '.'}`.text()
    outputs.push(result.trim())
  }

  return { output: outputs[outputs.length - 1] }
}
```

### Timeout-Aware Adapter

Reports its own timeout detection:

```typescript
import type { Adapter } from './src/improve.ts'

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const timeout = 30_000

  const proc = Bun.spawn(['my-agent', '--prompt', text], { cwd, stdout: 'pipe' })
  const timer = setTimeout(() => proc.kill(), timeout)

  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited
  clearTimeout(timer)

  const timedOut = exitCode === null // null = killed by signal
  return { output: timedOut ? '' : output.trim(), exitCode, timedOut }
}
```

### In-Process Adapter (No Subprocess)

For agents with a library API — no process spawning needed:

```typescript
import type { Adapter } from './src/improve.ts'

export const adapt: Adapter = async ({ prompt, cwd }) => {
  // Call agent library directly
  const agent = createAgent({ workspace: cwd })
  const response = await agent.run(Array.isArray(prompt) ? prompt.join('\n') : prompt)
  return {
    output: response.text,
    trajectory: response.steps,
    timing: { inputTokens: response.usage.input, outputTokens: response.usage.output },
  }
}
```

## Usage with Improve

```bash
# CLI: path-based loading
plaited eval '{"adapterPath":"./my-adapter.ts","promptsPath":"prompts.jsonl","k":5}'

# Library: function-based (primary)
import { runTrial } from './src/improve.ts'
const results = await runTrial({ adapter: myAdapter, prompts, k: 5 })
```

Adapters can also feed broader `src/improve` workflows beyond repeated trials.
The same capture surface is useful wherever Plaited wants structured evidence
from a non-native execution path.

## Tips

- Return `trajectory` for richer analysis (thought steps, tool calls)
- Return `timing.inputTokens`/`outputTokens` if the agent exposes usage
- Set `timedOut: true` if the adapter detects its own timeout
- Use `cwd` for workspace-isolated code generation tasks
- For multi-turn, the runner sends the full `prompt: string[]` — the adapter decides how to sequence turns
- Prefer Pi and Plaited-native adapters when those are the main execution modes; keep
  truly generic wrappers only when exposing `improve` as a consumer-facing surface

## Related

- **[trial-runner](../trial-runner/SKILL.md)** — Running trials with adapters
- **[compare-trials](../compare-trials/SKILL.md)** — Comparing trial results
