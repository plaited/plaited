---
name: autoresearch-workflows
description: Use Plaited's dev-research operator tooling. Covers `plaited eval`, `plaited compare-trials`, `plaited program-runner`, and `plaited autoresearch`, plus how module-lane writable roots constrain mutations.
license: ISC
---

# Autoresearch Workflows

Use this skill when operating `dev-research/` lanes with the official CLI
surfaces:

- `plaited eval`
- `plaited compare-trials`
- `plaited program-runner`
- `plaited autoresearch`

## Surface Selection

Choose `plaited eval` when you need repeated execution over prompts with grader
scoring and JSONL trial output.

Choose `plaited compare-trials` when you already have retained trial files and
need aggregate and per-prompt deltas.

Choose `plaited program-runner` when you need bounded fanout attempts from a
`dev-research/*/program.md` lane with durable attempt artifacts.

Choose `plaited autoresearch` when you need a bounded optimization loop around
adapter/prompts/grader inputs for a declared target surface.

## Standard Operator Loop

1. Select a lane `program.md` under `dev-research/`.
2. Run fanout with `plaited program-runner run ...`.
3. Evaluate retained candidates with `plaited eval ...`.
4. Compare runs with `plaited compare-trials ...`.
5. Run `plaited autoresearch ...` when bounded iterative search is required.

## Mutation Boundaries

- Read as broadly as needed for context.
- Mutate only within writable roots declared by the active lane.
- For module lanes, keep edits inside `src/modules/` and `src/modules.ts`
  unless lane config explicitly widens scope.

## Command Patterns

```bash
plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","graderPath":"./grader.ts","k":5,"concurrency":2}'
plaited compare-trials '{"baselinePath":"baseline.jsonl","challengerPath":"challenger.jsonl"}'
plaited program-runner run '{"programPath":"dev-research/default-modules/program.md","attempts":3,"parallel":2}'
plaited autoresearch '{"target":{"kind":"module","id":"skills-module"},"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","graderPath":"./grader.ts"}'
```

## Operator Expectations

- Prefer these CLI surfaces over ad hoc scripts for repeatable evaluation work.
- Keep artifacts durable: JSONL outputs, attempt status, diffs, and validation
  results should remain inspectable while runs are active.
- Keep concurrency bounded and increase only after stable parse/validation
  behavior is confirmed.
