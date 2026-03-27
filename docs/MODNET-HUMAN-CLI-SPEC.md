# Modnet Human CLI Spec

## Purpose

This document defines the general modnet planning model and the new
human-in-the-loop Pi workflow that replaces slice-driven prompt refinement.

The goal is not another autonomous research lane. The goal is a durable,
reviewable operator workflow where:

- a human reviews prompts directly
- OpenRouter models propose rewrites and lower-scale derivations
- a judge model scores candidate outputs
- the runtime persists every decision and attempt locally
- final exported artifacts stay minimal and training-oriented

## Legacy Terms

### Program

A `program.md` file defines the active workstream and operator intent for a
research lane.

Historically, a program was decomposed into numbered slices. Each slice was a
bounded execution or calibration step.

### Slice

A slice was a short-lived unit of work with:

- a problem statement
- a narrow scope
- an execution plan
- a result or promotion decision

Slices were useful for exploration, but they introduced overhead once the work
shifted from broad research into direct human curation.

### Fanout / Agent Hub

Fanout means running multiple independent attempts in parallel against the same
problem. In earlier modnet work this often meant:

- several strategy variants
- per-attempt isolated workspaces or worktrees
- durable attempt artifacts
- a judge selecting the strongest candidate

The important invariant is not the specific tool. The invariant is:

- attempts must be isolated
- attempts must be observable
- attempts must write durable results

Opaque in-memory fanout is not acceptable.

## New Operating Model

Modnet now uses a single CLI-centered program rather than slice-by-slice prompt
generation.

The operator workflow is:

1. review an existing prompt
2. decide whether to keep, remove, refine, or derive lower-scale prompts
3. if refinement is needed, provide direct human feedback
4. run a bounded fanout of model-written alternatives
5. score the alternatives with a judge model
6. surface the winning candidate back to the human
7. accept it, reject it, or launch another round
8. if accepted, optionally derive smaller-scale prompts from it

This turns the system into a guided refinement loop rather than a fully
autonomous discovery loop.

## Runtime Responsibilities

The control plane is a small Bun orchestration layer around Pi RPC.

It must:

- load prompts from curated source files
- present prompts interactively in the terminal
- capture human decisions and feedback
- launch Pi and helper model workers as subprocesses
- run bounded fanout for rewrite and derivation rounds when needed
- score results through a judge model
- notify the operator when a winning result is ready
- persist all runtime state under a local ignored directory
- resume cleanly after interruption

The runtime must not rely on Codex as a participant.

## Model Roles

The runtime loop uses OpenRouter models directly.

- `minimax-m2.7`: Pi strategy-planning model
- `glm-5`: primary prompt rewriter / derivation proposer
- `minimax-m2.5`: fixed-rubric judge

Pi is not the generator and not the judge. Pi creates per-worker strategy
variation that shapes the generator prompt.

`glm-5` and `m2.5` should receive the same shared context bundle and the same
source prompt for a given attempt. If the round is a revision, they should also
receive the same human feedback.

The human is the final verifier.
There is no meta-verifier in this workflow.

## Fanout Rules

Each refinement or derivation round may use bounded fanout.

Default operating shape:

- `5` concurrent workers
- `15` total attempts per round

Each attempt may vary by strategy note, wording pressure, or decomposition
approach, but all attempts must share the same base prompt and human feedback
for that round.

Every attempt must write durable artifacts:

- input payload
- result payload
- stdout log
- stderr log
- status file

## Runtime Storage

All runtime state belongs in a local ignored directory:

- `.prompts/`

This directory is for:

- prompt queues
- human decisions
- fanout attempt artifacts
- winner artifacts
- session summaries

This directory is not the final corpus.

## Final Training Artifact

The final exported training artifact must be minimal.

Only keep:

- `id`
- `prompt`
- `mss`

No parent lineage, judge metadata, attempt history, or review notes belong in
the final exported corpus.

Example:

```json
{
  "id": "nyc-subway-station-navigator",
  "prompt": "Build a local-first station navigator for browsing subway stops and tracing connections.",
  "mss": {
    "contentType": "network-navigation",
    "structure": "object",
    "mechanics": ["record"],
    "boundary": "none",
    "scale": 1
  }
}
```

## Source Inputs

The initial prompt sources for this workflow are:

- handcrafted prompts
- Slice 15 recommended classified prompts
- Slice 15 salvage classified prompts

These are the operator-visible source materials used for refinement and
derivation.

## Program Context

`dev-research/training-prompts/program.md` is the standing operating context for the workflow.

It is the stable high-level contract for:

- model roles
- prompt-review rules
- derivation rules
- export rules

Human interaction augments `program.md` with prompt-specific feedback during the
review loop.

## Pi Integration

Pi should be used in RPC mode, with a Bun parent process coordinating review.

This gives the workflow:

- interactive prompt review
- structured message exchange over stdin/stdout
- durable orchestration in Bun
- the option to attach helper scripts for generation and judging

This is preferred over a fully bespoke agent shell.

## Framework Direction

This workflow is intentionally close to the eventual framework direction.

The long-term goal is to fold this human-guided prompt refinement loop into the
framework's trial/eval tooling so that:

- interactive refinement
- candidate generation
- judging
- export

can all run in a unified framework-native loop.

## Replacement Rule

Slice-driven modnet prompt work is deprecated for this lane.

The active modnet workflow is:

- one `program.md`
- one Pi-backed interactive runtime
- bounded subprocess fanout when needed
- local durable runtime state
- minimal final training exports
