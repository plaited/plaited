---
name: autoresearch-workflows
description: Use Plaited's dev-research operator tooling. Covers `plaited eval`, `plaited compare-trials`, `plaited program-runner`, and `plaited autoresearch`, plus how factory-lane writable roots constrain mutations.
license: ISC
---

# Autoresearch Workflows

## Purpose

Use this skill when working in `dev-research/` and the task is to evaluate,
compare, fan out, or hill-climb harness and factory changes through the real
CLI surfaces.

This is the operator guide for:

- `plaited eval`
- `plaited compare-trials`
- `plaited program-runner`
- `plaited autoresearch`

## Choose The Right Surface

Use `plaited eval` when:

- the unit under test is an adapter, model, or agent response
- you want repeated prompt execution with pass@k-style metrics
- you want trajectories or capture evidence retained in `TrialResult` output

Use `plaited compare-trials` when:

- you already have two `TrialResult` JSONL files
- you need aggregate comparison, confidence intervals, and per-prompt winners
- you want a reusable comparison surface instead of ad hoc inline scripts

Use `plaited program-runner` when:

- the unit of work is a `dev-research/*/program.md` lane
- you want multiple bounded attempts in isolated worktrees
- you need durable attempt artifacts and validation results

Use `plaited autoresearch` when:

- you want a bounded improvement loop around eval
- you need observations, candidate artifacts, validation, and promotion state
- the target surface is currently `skill` or `factory`

## Dev-Research Workflow

The typical loop is:

1. pick a lane under `dev-research/`
2. fan out candidate attempts with `plaited program-runner`
3. measure promising candidates with `plaited eval`
4. compare retained runs with `plaited compare-trials`
5. package or revisit candidates through `plaited autoresearch`

## Program Lane Scope

For factory lanes, `program-runner` writable roots should stay inside:

- `src/factories/`
- `src/factories.ts`

Read broadly when the lane requires context, but keep mutations inside the
declared writable roots from the lane `program.md`.

## Command Patterns

Repeated eval:

```bash
plaited eval '{"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","graderPath":"./grader.ts","k":5,"concurrency":2}'
```

Compare two retained runs:

```bash
plaited compare-trials '{"baselinePath":"baseline.jsonl","challengerPath":"challenger.jsonl"}'
```

Run a research lane:

```bash
plaited program-runner run '{"programPath":"dev-research/default-factories/program.md","attempts":3,"parallel":2}'
```

Run bounded autoresearch:

```bash
plaited autoresearch '{"target":{"kind":"factory","id":"skills-factory"},"adapterPath":"./adapter.ts","promptsPath":"prompts.jsonl","graderPath":"./grader.ts"}'
```

## Notes

- `eval` is the repeated execution primitive
- `compare-trials` is the retained-run comparison surface
- `program-runner` is the lane fanout surface
- `autoresearch` coordinates bounded improvement around those primitives

Prefer these CLI surfaces over custom one-off scripts unless the analysis is
truly novel.
