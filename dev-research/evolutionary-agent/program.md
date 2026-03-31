# Evolutionary Agent Program

## Purpose

This program defines a long-horizon research lane for improving a local agent
system through evolutionary optimization of the harness around a base model.

The goal is not to train a frontier model from scratch. The goal is to:

- start from a small or medium local model
- surround it with a stronger symbolic and tool-using harness
- evolve that harness through parallel task rollouts
- use judges, humans, and deterministic evals to select better variants
- periodically distill stable winning behavior into cleaner defaults, datasets,
  or retained policy artifacts

This lane is intended to run on the MSI machine over long periods.

## Core Hypothesis

Small local models fail more from weak harness design than from lack of raw
weights alone.

Instead of trying to force broad world knowledge into the model first, we should
evolve:

- when the agent admits uncertainty
- when it invokes retrieval or web search
- how it plans and decomposes work
- how it structures symbolic behavioral threads
- how it uses memory
- how it critiques and retries
- how it selects and applies tools

The model remains important, but the first optimization target is the policy and
runtime around the model.

## Secondary Hypothesis

OpenResearcher suggests a useful direction for this lane: long-horizon agent
improvement benefits from fully instrumented environments, explicit tool
primitives, and reproducible trajectory generation rather than opaque
proprietary loops.

Relevant takeaway from:

- `https://arxiv.org/abs/2603.20278`

The useful transfer is:

- explicit search / open / find style primitives
- replayable trajectories
- offline or partially cached corpora where possible
- analysis of where retrieval succeeds or fails
- separating corpus bootstrapping from multi-turn trajectory synthesis

This program is not a copy of that paper, but it should borrow those design
lessons.

## Target System

The target is a hybrid agent stack with:

- a local base model on MSI
- an evolvable harness
- optional web search and retrieval
- symbolic behavioral threads
- tool policies
- persistent memory
- judges and task evals
- human checkpoints when needed
- worktree-backed parallel experimentation

In repo terms, the intended foundation is:

- `scripts/autoresearch-runner.ts` for candidate generation and durable attempt orchestration
- `src/improve` for judging, verifier/meta-verification, and promotion selection
- lane `program.md` files for bounded mutation targets
- accepted attempt commits and judged outputs as retention and distillation inputs

## What Evolves

The main genome is the harness, not just a single prompt.

### Policy Surface

- system prompts
- tool policies
- search behavior
- planning behavior
- decomposition strategy
- memory formatting
- self-critique rules
- retrieval invocation rules
- evidence aggregation rules
- answer finalization rules

### Symbolic Surface

- behavioral threads
- exemplar trajectories
- successful repair traces
- negative examples
- retry templates
- summarization templates
- memory item schemas

### Learned Surface

Only after the policy surface is useful:

- LoRA or adapter weights
- lightweight rerankers
- local policy heads
- distilled prompt-pack or thread-pack datasets

## What Should Not Evolve First

Do not begin by trying to evolve all model weights directly.

Do not assume the first win is larger model size.

Do not optimize for benchmark score alone if tool policy and retrieval quality
are not instrumented.

## Evolution Loop

Each generation should look like:

1. define a current Plaited node variant
2. mutate one or more surfaces
3. run many task rollouts in parallel
4. score outcomes
5. keep, recombine, or discard variants
6. log all trajectories and errors
7. distill or codify persistent improvements

The parallel rollout layer should use the same general approach we have used in
past sessions:

- multiple candidates in parallel
- worktree-backed or equally durable attempt directories
- observable status and artifacts
- judged selection
- resumable state

Concretely, this means:

1. mutate a Plaited node variant or a lane-local policy surface
2. generate candidate attempts with `autoresearch-runner`
3. run deterministic validation inside each attempt
4. evaluate surviving attempts with `src/improve`
5. use optional meta-verification when selection confidence matters
6. promote only accepted attempts
7. extract retained trajectories, patches, summaries, and accepted commits for future distillation

## Unit Of Mutation

The unit of mutation should not be assumed to be a separate packaged artifact.

For now, this lane should treat a bounded Plaited node variant as the unit of
mutation.

That means the evolving surface is a reviewable subset of the shipped Plaited
system and its install/runtime behavior, not a second standalone product
format.

The mutated surface may include:

- system prompt
- tool registry and policy
- search policy
- planning template
- decomposition rules
- memory schema
- self-critique rubric
- retrieval rules
- symbolic thread bundle
- bootstrap-owned install or default-configuration behavior
- top-level node composition behavior
- optional small learned adapter

This lane should stay compatible with the broader repo direction:

- `plaited` remains the shipped package CLI
- `src/bootstrap` remains the install/setup boundary for the node
- evolutionary work should improve that shipped node and its defaults rather
  than implicitly defining a separate runtime product

## Search and Retrieval Principle

Because SLMs lack broad knowledge, the target behavior is:

- know
- search
- cite
- act

not:

- know everything

The system should learn when to:

- invoke web search
- invoke offline corpus lookup
- invoke MCP / retrieval tools
- refuse unsupported claims
- escalate uncertainty

One of the main long-horizon goals is to push this retrieval policy from ad hoc
rules into a stable and learnable part of the harness.

## Symbolic Behavioral Threads

Behavioral threads are part of the training substrate.

They should capture:

- successful task trajectories
- tool-choice moments
- uncertainty declarations
- search invocation moments
- failure recovery
- decomposition and merge patterns
- memory writes and reads

These threads should be evolved and curated just like prompts.

They are not auxiliary data. They are part of the control policy.

## Evaluation Stack

Evaluation should be layered.

### Deterministic Signals

- task completion
- tool-call correctness
- citation presence
- syntax / schema validity
- latency
- token usage
- retry count
- crash rate

### Judge Signals

- answer quality
- evidence grounding
- search appropriateness
- decomposition quality
- memory usefulness
- hallucination resistance

### Verifier Signals

- confidence in judge output
- disagreement or ambiguity across close candidates
- whether an accepted attempt is safe to retain or promote automatically

### Human Signals

- practical usefulness
- trustworthiness
- readability
- whether the behavior feels like a better agent, not just a better scorer

## Current Tooling Fit

Current repo tooling already supports part of this program:

- `autoresearch-runner` gives:
  - worktree-backed attempts
  - durable status and result artifacts
  - deterministic validation
  - resumable evaluation

- `src/improve` gives:
  - trial-result evaluation
  - attempt-level judge / meta-verifier / promotion prompt tooling
  - singular research-program loading and scope checks
  - selection-signal summaries and retained-artifact helpers
  - judge/meta-verifier contracts
  - promotion selection scaffolding

What still needs improvement to fully support this lane:

- explicit mutation-target or variant schemas once the target surface is stable
- mutation lineage and recombination support
- richer long-horizon trajectory capture and replay
- retrieval/search-specific evaluation dimensions
- verifier outputs that carry richer symbolic/self-verification findings
- training-data extraction from accepted evolutionary runs as a downstream step
- stronger support for comparing policy bundles, not just isolated attempts

## Phases

### Phase 1: Stable Prompt and Thread Substrate

Finish:

- prompt corpus
- symbolic behavioral thread format
- basic harness
- eval suite

### Phase 2: Harness Evolution

Optimize:

- system prompts
- tool and search policy
- planning and decomposition
- memory formatting
- self-critique

### Phase 3: Retrieval and Research Behavior

Optimize:

- search invocation
- evidence aggregation
- browsing loop quality
- citation and answer grounding

### Phase 4: Distillation

Distillation should consume the highest-confidence outputs from the evolutionary
loop:

- accepted attempt commits
- judged and meta-verified summaries
- retained trajectories and repair traces
- durable policy artifacts that should become skills, memory, or runtime defaults

`trial-runner` remains useful for repeated reliability suites, but it is not the
center of this lane. The center is `autoresearch` for candidate generation and
`improve` for evaluation and selection.

Raw eval output should stay evaluation-only. Retention, dataset extraction,
and later model-tuning inputs should come only after verification and
selection, not from early eval annotations.

Once stable patterns emerge:

- distill successful policies into cleaner defaults
- produce curated thread datasets
- train adapters or local policies where useful

### Phase 5: Ongoing Long-Horizon Improvement

Run as a continuous background research lane with:

- resumed generations
- periodic baselines
- periodic human audits
- periodic distillation

## Operational Rules

- use durable attempt directories or worktrees
- never rely on opaque in-memory fanout alone
- log trajectories and final scores
- preserve failed attempts for analysis
- treat hallucination reductions as a first-class objective
- separate harness improvements from model improvements in analysis
- change one or two layers at a time before attempting large combined searches

## Success Criteria

This lane is successful when the agent becomes measurably better at:

- knowing when it does not know
- invoking retrieval at the right time
- grounding answers in evidence
- using tools with fewer wasted calls
- decomposing longer tasks coherently
- carrying forward useful memory
- producing higher-trust outcomes with a modest local model

## Deliverables

Over time, this lane should produce:

- an evolvable Plaited node variant model or equally clear mutation contract
- a task and eval suite
- a trajectory corpus
- symbolic behavioral thread corpora
- improved harness defaults
- distilled adapters or local policies where justified
- a reproducible long-horizon research environment on MSI
