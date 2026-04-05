---
name: improve-workflows
description: Use `src/eval` for repeated evals and `src/program-runner` for factory-program fanout. Covers `runTrial`, eval adapters, graders, meta-verification, and `plaited program-runner`.
license: ISC
---

# Improve Workflows

## Purpose

This skill is the unified operator guide for Plaited's improve surface.

Use it when you need to:

- run repeated evals against an agent or adapter
- write or update `src/eval` adapters
- add graders or meta-verification to eval flows
- run bounded factory-program fanout over `dev-research/*/program.md`

This skill replaces the older split between `trial-runner` and
`trial-adapters`.

## The Three Improve Modes

### 1. Repeated Evals

Use `runTrial()` or `plaited eval` when you want pass@k-style repeated prompt
evaluation.

This is the right mode for:

- prompt suites
- adapter comparisons
- baseline vs candidate evals
- trajectory capture for later analysis

### 2. Adapter Authoring

Use adapters when an external or non-native runtime needs to participate in the
improve system.

Adapters can wrap:

- Plaited-native agents
- Pi or other coding agents
- custom CLIs
- in-process libraries

They should expose structured output and optionally trajectory/timing evidence.

### 3. Factory Program Fanout

Use `plaited program-runner` when the task is:

- mutate workspace state
- run multiple bounded attempts against a factory program
- validate attempt outputs in isolated worktrees
- retain durable per-attempt artifacts

This is the current bounded operator surface for factory research programs.

For current autoresearch direction, assume the first model family is Gemma 4.
Keep evals and program-runner lanes aligned around one cognitive contract across
tiers:

- local runs may use a smaller or quantized Gemma 4 variant
- stronger server runs may use a larger Gemma 4 variant
- avoid splitting logic across separate text and vision model families when the
  primary model already covers multimodal work

## Repeated Eval API

Library-first:

```ts
import { runTrial } from './src/eval.ts'
import type { Adapter, Grader } from './src/eval.ts'

const adapter: Adapter = async ({ prompt, cwd }) => {
  const proc = Bun.spawn(['my-agent', '--prompt', String(prompt)], { cwd, stdout: 'pipe' })
  const output = await new Response(proc.stdout).text()
  return { output }
}

const grader: Grader = async ({ output }) => ({
  pass: output.includes('ok'),
  score: output.includes('ok') ? 1 : 0,
})

const results = await runTrial({
  adapter,
  prompts: [{ id: 'p1', input: 'test prompt' }],
  grader,
  k: 5,
  concurrency: 2,
})
```

CLI:

```bash
plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","k":5}'
plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","graderPath":"./grader.ts","k":10,"concurrency":4}'
```

## Adapter Contract

Adapters follow the polyglot stdin/stdout or module-export pattern.

TypeScript module:

```ts
import type { Adapter } from './src/eval.ts'

export const adapt: Adapter = async ({ prompt, cwd }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const proc = Bun.spawn(['my-agent', '--prompt', text], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  return {
    output: output.trim(),
    exitCode,
  }
}
```

Executable adapter:

- reads `AdapterInput` JSON from stdin
- writes `AdapterResult` JSON to stdout

Useful optional fields:

- `trajectory`
- `timing`
- `exitCode`
- `timedOut`

## Graders And Meta-Verification

Use graders when repeated eval output is not self-judging.

Use meta-verification when:

- grader trust is uncertain
- outputs may be adversarial
- results feed promotion or retention decisions

`runTrial()` stays focused on repeated execution; verifier policy sits on top of
it through `src/eval`.

## Factory Program Fanout

Current operator surface:

```bash
plaited program-runner run '{"programPath":"dev-research/skill-factories/program.md","attempts":3,"parallel":2}'
plaited program-runner status '{"programPath":"dev-research/skill-factories/program.md"}'
```

The runner:

- loads a `program.md`
- derives writable scope from program scope when present
- creates worktree-backed attempts
- writes durable `run.json` and per-attempt `status.json`
- optionally runs a worker command and a validation command

Supported placeholders inside commands:

- `{{attempt}}`
- `{{artifact_dir}}`
- `{{program}}`
- `{{run_dir}}`
- `{{worktree}}`

Use this mode when the unit of work is a bounded program mutation, not a prompt
eval.

## When To Use Which Surface

Use repeated evals when:

- the thing under test is an adapter/model/agent response
- you want to compare local versus server-backed variants inside the same model
  family without changing the adapter contract

Use factory-program fanout when:

- the thing under test is a workspace/program mutation
- the harness or factory policy is the thing evolving, not the model interface

Use adapters when:

- the runtime being evaluated is not already inside `src/eval`

## Related Skills

- `compare-trials` for result comparison and pass@k analysis
