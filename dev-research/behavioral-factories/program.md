# Behavioral Factories

## Goal

Research and compile behavioral-factory patterns that let Plaited evolve a
capable personal agent on top of its stable symbolic foundations.

This lane is not just about compiling one-off factories from upstream seed and
corpus artifacts. It is the lane that should discover and refine the factory
architecture needed for:

- mutable policy and harness surfaces
- observable rollouts
- scoring and selection
- retained artifacts for reuse and distillation
- git-backed memory and retrieval

The stable runtime foundation is assumed to remain:

- `src/behavioral`
- `src/ui`
- most of `src/server`

Everything else is up for change if it better leverages those foundations.

## Dependency Order

1. `mss-seed` defines compact MSS anchors.
2. `mss-corpus` encodes MSS and Modnet evidence against those anchors.
3. `behavioral-seed` defines compact behavioral and constitution anchors.
4. `behavioral-corpus` encodes behavioral and governance evidence against those
   anchors.
5. `behavioral-factories` compiles and researches the factory architecture that
   uses those anchors and corpus artifacts to drive agent evolution.

This lane should consume upstream contracts. It should not recreate upstream
seed or corpus responsibilities.

## Purpose

The purpose of this lane is to determine what behavioral-factory patterns are
needed for an evolvable agent system.

That includes researching and refining:

- orchestration factories
- working-memory factories
- durable-memory factories
- rollout factories
- validation factories

These factories should make it possible for a model to internalize behavioral
programming, MSS, and the Plaited UI layer while still using tools, retrieval,
and symbolic coordination when needed.

## Engine vs Policy Boundary

This lane should assume a strong separation between generic engines and
provisioned behavior.

The intended boundary is:

- `src/behavioral` remains the stable BP engine
- `src/bootstrap` is the setup and install boundary for the initial node
- `bin/plaited.ts` is the centralized package CLI entrypoint
- `src/cli.ts` should stay a shared CLI helper surface, not a second executable
- `src/server` remains the browser transport adapter and route host
- `src/ui` remains a render surface plus client-side behavioral runtime
- `src/agent` is the generic agent engine
- `src/factories` should contain promoted executable factory implementations
- `src/inference` should contain model/provider-facing integration code
- `src/skill` should be the boundary for skill usage, discovery, validation,
  ingestion, and related tooling/utilities
- `skills/*` contains shipped default skills
- `src/hypergraph` should be the export boundary for durable-memory graph
  querying and graph algorithms

The agent engine should own only stable mechanics such as:

- lifecycle
- heartbeat and timing primitives
- thread and handler registration
- restricted trigger boundaries
- runtime SQLite substrate for transient shared runtime context
- built-in local execution capability scoped by agent `cwd` and `env`
- safe execution boundaries

Factories should own most actual behavior, including:

- proactive behavior
- retrieval behavior
- validation behavior
- governance behavior
- rollout behavior
- working-memory behavior
- durable-memory behavior
- bootstrap/top-level node composition behavior
- top-level A2A behavior
- server-facing notification and projection behavior
- skill installation and skill-aware behavior

Factories should still prefer BP-native coordination patterns.
`async` `useFeedback` handlers are acceptable and expected when they are doing
bounded side-effect work.

Prefer:

- explicit request/result or request/completion event pairs
- bThreads that wait, block, and interrupt around those events
- handlers that stay narrow and side-effect oriented

Be cautious of factories that hide too much orchestration inside one handler,
especially when that handler relies on imperative branching and internal
control flow that would be clearer as explicit behavioral event choreography.

This lane should prefer executable TypeScript factory surfaces over
embedding these behaviors directly into the core agent engine.

Successful experiments should not only demonstrate a behavior. They should also
improve the architecture by:

- removing or shrinking hardcoded factory-like logic from `src/agent`
- replacing transitional bootstrap compositions with top-level executable
  factories
- promoting accepted executable behavior into `src/factories`
- leaving the core agent engine smaller and more generic than before

The intended `create-agent` direction is minimal:

- input:
  - `id`
  - `cwd`
  - optional `env`
  - `factories`
  - `restrictedTriggers`
  - `heartbeat`
- output:
  - restricted trigger as the main public action surface
  - `useSnapshot`

Disconnect should be modeled as an event, not as the primary imperative return
surface.

This lane should treat the deletion of `create-agent-loop.ts`, `src/runtime`,
`src/modnet`, and `src/tools` as accomplished architecture work. Future effort
should not recreate those layers under new names.

This lane should also assume a single centralized package CLI:

- `plaited` is the only shipped binary
- the older separate `plaited-improve` surface should stay folded into that
  centralized router
- shared CLI parsing and handler helpers belong in `src/cli.ts`
- shipped skills such as `typescript-lsp` are package artifacts, but should not
  automatically be treated as top-level `plaited` commands unless explicitly
  wired into the router

This lane should treat `src/improve` carefully:

- raw eval outputs should remain evaluation-only
- eval outputs may include:
  - pass/fail
  - score
  - dimensions
  - outcome
  - timing
  - trajectory
  - capture
  - pass@k / pass^k style aggregates
- raw eval outputs should not embed retention or training policy annotations
- any retention, distillation, or selection-for-training helpers should remain
  separate from the raw eval output contract
- the old `training.ts` / `training-score` surface has been removed
- `src/improve` should now bias toward:
  - `attempt-evaluation.ts`
  - `research-program.ts`
  - `evolution.ts`
  - verifier and self-verifier contracts in `judge-contracts.ts`

For the next stage, this lane should bias toward tooling that supports
`dev-research/evolutionary-agent/program.md` directly:

- mutation tooling over package or harness surfaces
- rollout orchestration
- verification and self-verification
- judged selection
- promotion tooling
- retained artifact capture for later distillation

## Inputs

Primary lane inputs:

- `dev-research/behavioral-factories/program.md`
- `dev-research/mss-seed/program.md`
- `dev-research/mss-seed/seed/`
- `dev-research/mss-corpus/program.md`
- `dev-research/mss-corpus/encoded/`
- `dev-research/behavioral-seed/program.md`
- `dev-research/behavioral-seed/seed/`
- `dev-research/behavioral-corpus/program.md`
- `dev-research/behavioral-corpus/encoded/`
- `dev-research/evolutionary-agent/program.md`
- `skills/behavioral-core/SKILL.md`
- `skills/constitution/SKILL.md`
- `skills/mss/SKILL.md`
- `src/behavioral/behavioral.ts`
- `src/ui/`
- `src/factories/`
- `src/inference/`
- `src/agent/`
- `src/skill/`
- `src/hypergraph/`
- `src/server/`

Supporting implementation and memory-shaping surfaces:

- `skills/hypergraph-memory/SKILL.md`
- Bun runtime docs and relevant local usage patterns for:
  - markdown
  - yaml
  - html rewriting
  - file IO
  - JSONL streaming
  - archive export
  - SQLite runtime context

## Input Priority

Use these inputs with clear precedence:

1. `src/behavioral`, `src/ui`, and stable `src/server` surfaces are the runtime
   foundation.
2. git-backed markdown, code, and local file history are the primary authored
   durable-memory substrate.
3. behavioral and MSS seed/corpus artifacts are derived semantic inputs that
   can accelerate retrieval, validation, and compilation.
4. skills are implementation and teaching surfaces, not the final runtime home
   of the system.
   Default shipped skills are still first-class package artifacts and should be
   installed from bootstrap rather than reintroduced as ad hoc tool modules.
5. if a simpler markdown / yaml / jsonl / archive approach satisfies the lane
   goal better than a graph-heavy approach, prefer the simpler approach.

This lane must not treat hypergraph as the primary authored memory surface.
Markdown, code, and git remain the canonical authored durable-memory
substrate. Hypergraph should instead be treated as the durable linking and
provenance layer across those authored surfaces. Use it when it materially
improves:

- retrieval
- provenance
- compositional reasoning
- stable symbolic anchors

## Memory Strategy

This lane should treat git-backed markdown and code as the default authored
durable-memory foundation.

Canonical memory surfaces may include:

- markdown documents
- code files
- yaml fragments
- jsonl traces
- html fragments or rewritten extracts
- commit messages
- diffs and patch history
- git-backed context packs
- archive exports

Hypergraph should link those authored surfaces durably across:

- commits
- markdown
- code artifacts
- retained memory items

Git is part of the memory model, not just version control. It provides:

- temporal ordering of understanding
- compact summaries through commit messages
- expansion through diffs, older revisions, and blame/history
- provenance linking memory back to concrete file changes

Derived semantic artifacts may still exist, but they should serve retrieval,
validation, provenance, training, and durable linking rather than replacing
the authored memory surfaces.

Hypergraph tools should be used both as accelerators over markdown/code/git
memory and as the durable semantic/provenance linking layer, for example to:

- rank likely relevant files or artifact groups
- follow semantic links across retained seed/corpus artifacts
- connect related concepts across commits, files, and docs
- narrow what the agent should inspect with direct git and file tools

Default retrieval should begin with:

- direct file reads
- markdown link traversal
- `git log`
- `git show`
- `git diff`
- targeted commit and path inspection

The lane should only reach for heavier semantic machinery when these simpler
surfaces are insufficient.

This lane should keep durable memory distinct from runtime coordination state:

- durable memory is commit- and artifact-linked
- shared runtime context is transient
- shared runtime context should be treated as engine-owned and may be backed by
  in-memory SQLite
- transient runtime context should not be confused with retained durable memory

## Agent Lifecycle

This lane should assume an agent lifecycle shaped roughly like this:

1. create the agent engine
2. provision factories, validators, and memory surfaces
3. start the loop and heartbeat
4. assemble bounded working memory for the next step
5. let the model reason within that context
6. let deterministic factories decide retrieval, execution, retry, escalation,
   validation, or stop based on reasoning-derived signals
7. validate outputs before retention or promotion
8. on accepted work, project durable memory from commit-bounded context
9. continue, replay, fan out to worktrees, hand off, or stop

Heartbeat should be considered part of the core engine even if no current
factory listens to it. Factories may attach behavior to that pulse later, and
may also adjust its timing through explicit control surfaces.

## Bootstrap And A2A Boundary

This lane should now assume:

- `src/a2a` remains a protocol and transport library
- `src/bootstrap` exposes A2A only for the top-level agent
- `src/bootstrap` installs shipped default skills for the top-level agent
- A2A behavior itself should be implemented by top-level factories
- internal agents and modules must not communicate through A2A directly

The purpose of this boundary is to keep external communication under one
explicit control point so that internal factories and modules do not
accidentally exfiltrate data outside the node.

This means the lane should research and refine factories for:

- top-level A2A request handling
- top-level Agent Card projection
- A2A extension-aware behavior
- bootstrap-time composition of the initial agent and server
- runtime snapshot capture and promotion
- durable-memory linking through hypergraph-aware factories

`src/a2a` should not absorb BP orchestration concerns.
`src/bootstrap` should not become a new rich runtime ontology.
Those layers should stay thin while top-level factories own the behavior.

## What This Lane Should Discover

The lane should answer questions such as:

- what is the right unit of mutation for the agent package?
- which factory families are actually needed?
- how should context packs be built from files, traces, and source artifacts?
- when should the agent rely on symbolic context vs retrieval vs search?
- how should retained artifacts be summarized and reused?
- how should git history be compacted and expanded as working memory?
- how should commit messages and diff metadata be turned into useful context?
- how should repo boundaries shape delegation and memory isolation?
- when should an experiment clean up or replace an older hardcoded path?
- what deterministic validators best constrain generated behavioral code?

## Factory Families

The lane should explore and refine factory families such as:

### Orchestration Factories

Orchestration factories should focus on deterministic tool and memory
orchestration, not on trying to encode the model's internal reasoning directly.

The model should still do the reasoning. Orchestration factories should watch for
reasoning-derived signals and deterministically decide what happens next.
Those decisions may recurse back into the model with new obligations, richer
context, or a different coordination path.

Examples of reasoning-derived signals include:

- uncertainty markers
- unsupported claims
- unresolved dependencies
- cross-repo implications
- repeated failed retrieval or critique cycles

Orchestration factories should therefore focus on surfaces such as:

- search policy
- retrieval invocation policy
- git/history inspection policy
- context-pack selection policy
- uncertainty and escalation policy
- critique and retry policy
- answer finalization and stop policy

They should be designed so that:

- the trigger conditions are observable
- the next action is deterministic and reviewable
- the resulting loop back to the model is bounded and inspectable

### Working-Memory Factories

Working-memory factories should build bounded working-memory packs for the next
model or agent step.

They are responsible for assembling reviewable context from:

- current files
- markdown links
- git history and diffs
- retained traces
- optional semantic accelerators

They should focus on deterministic questions such as:

- which files belong in the pack?
- which commits or diffs are relevant?
- which markdown links should be expanded?
- what should be summarized vs included verbatim?
- what constraints and obligations must follow the pack?

They should be especially important for cross-repo or cross-agent handoff,
where a bounded context pack must carry:

- summaries
- links
- commit references
- diffs
- constraints
- unresolved questions

Preferred working-memory surfaces include:

- markdown pack builders
- source-link expansion
- git-context pack builders
- diff and snapshot pack builders
- repo handoff pack builders
- compacted-memory summary builders

YAML should be treated as secondary, mostly for frontmatter extraction or small
configuration surfaces rather than a primary context-pack format.

### Durable-Memory Factories

Durable-memory factories should manage durable memory projection and reuse.

These factories are distinct from working-memory factories:

- working-memory factories build ephemeral context for the next step
- durable-memory factories update retained memory after accepted changes or commits

They should treat accepted commits as the main boundary for durable memory
projection. A commit is the durable event boundary, not automatically the final
summary itself.

They should also project durable links through the hypergraph layer so that
commits, markdown, code artifacts, and retained memory items stay connected
through stable provenance.

These factories should deterministically gather the source context for durable
memory updates, such as:

- commit metadata
- diffs
- touched files
- validation results
- linked handoff context
- retained artifacts that were explicitly accepted

Within that bounded context, the model may still be used to draft summaries or
projections for durable memory. The resulting memory write should then be
validated before retention.

That means they may:

- write memory decisions
- summarize accepted work into durable memory
- project commit metadata into a minimal graph/link layer
- record handoff links between repos, commits, files, and summaries
- support retrieval ranking and packing
- prune or compact stale memory

The minimal graph layer should therefore be commit-derived and reviewable,
rather than the primary authored memory surface.

The existing `src/agent/memory-handlers.ts` path should be treated as
transitional debt, not as the target architecture. This lane should be willing
to replace it entirely with durable-memory factories that use the hypergraph
tooling as part of memory projection.

### Rollout Factories

Rollout factories should define how multi-step work unfolds across the main
workspace repo and any bounded repos under `modules/*`.

They should be worktree-first, not branch-first.

That means they should:

- use worktrees for active exploration
- use commits as durable rollout checkpoints
- use frontier or leaf concepts for orchestration and replay
- avoid making branch management central to the workflow

Their responsibilities include:

- task decomposition
- worktree fanout decisions
- compare-and-select strategy across worktree attempts
- replay-from-commit strategy
- escalation and abort strategy

Rollout factories should help answer questions such as:

- when should work stay in the current repo vs move to a module repo?
- when should the agent create one worktree vs several?
- when should competing worktree attempts be compared or discarded?
- which accepted or frontier commits should be replayed or expanded?
- when should work stop, escalate, or hand off to another repo-scoped agent?

The intended model is:

- the workspace repo is itself a git-backed operating memory surface
- `modules/*` may be separate git repos with their own histories and worktrees
- OS-level backup handles catastrophic recovery outside the runtime

Rollout factories should therefore optimize local exploration, comparison, and
checkpointing within these repos rather than assume a traditional GitHub-style
branch or PR workflow.

### Validation Factories

Validation factories should act as the deterministic quality gate over code,
context, handoff, and replay surfaces.

They should go beyond narrow code checks and validate:

- code correctness
- context-pack correctness
- handoff correctness
- commit and replay validity

Important validation signals include:

- `bun --bun tsc --noEmit`
- Biome formatting and structural checks
- behavioral anti-pattern guards
- TypeScript / LSP seam checks
- TSDoc presence and placement where required
- test-selection and execution rules
- contract-shape validators
- context-pack and handoff validators
- commit and replay target validators

Behavioral anti-pattern validation should explicitly watch for patterns such
as control-flow-heavy `useFeedback` handlers with imperative branching and
orchestration logic that would be clearer as explicit behavioral event
choreography.

Biome is useful not only as a style check, but also because:

- it enforces consistency
- it keeps generated code reviewable in emergencies
- `biome --write` shows the agent what correct code should look like

TSDoc and LSP should also be treated as meaningful validation surfaces:

- TSDoc can be required before important blocks or exported seams
- hover/signature/definition data can be returned to the agent as repair
  context
- this helps the agent align generated code with the intended runtime seams

This lane should also consider replacing or narrowing generic commit-hook
automation such as `lint-staged` with more explicit validation/event factories.
Commit hooks can be treated as event sources that trigger validation threads
with known file inputs, giving the runtime more control and reducing recurring
`git/index` coordination issues.

## Runtime SQLite Direction

This lane may introduce a shared runtime-context layer backed by in-memory
SQLite, so long as factories still interact with it behaviorally through
triggered events and installed handlers.

Factories should not receive a direct shared context object.
Instead, they should operate through:

- `trigger`
- `useSnapshot`

Shared runtime context should be mediated through triggered events and default
handlers installed by `create-agent`.

The preferred initial runtime SQLite surface should mirror Bun's statement
execution model more closely than a generic CRUD abstraction.

Good initial operations include:

- `run`
- `get`
- `all`
- `values`

The lane may also add, if the work shows they are needed:

- `iterate`
- `toString`
- `finalize`

The engine should own runtime SQLite lifecycle, including setup, statement
caching, and cleanup on teardown or disconnect.

## Promotion Expectations

This lane should treat architectural cleanup as part of successful promotion.

A strong promoted result should usually:

- replace or shrink a hardcoded behavior in `src/agent`
- create or improve executable TypeScript factories in `src/factories`
- preserve or improve validation coverage
- make the resulting architecture easier to inspect and extend

Experiments that only add parallel behavior without simplifying the older path
should generally be treated as incomplete.

## External Retrieval

Primary evidence should come from the listed local inputs and lane-provisioned
skills. If those are insufficient, external retrieval may use targeted web
search via the provisioned You.com skill.

Use external retrieval only to:

- confirm missing runtime or compilation semantics
- verify terminology or implementation patterns not present locally
- compare bounded alternative approaches for memory, retrieval, or evaluation

Do not treat web search as the primary source of truth for this lane.
If external retrieval materially changes the result, record that in the run
summary.

## Repo-Scoped Coordination

This lane should assume Plaited may evolve toward multiple bounded repos or
repo-like modules coordinated by a PM/orchestrator agent.

That means the lane should explore factory patterns for:

- repo selection and routing
- repo-local context pack construction
- bounded delegation to repo-scoped worker agents
- cross-repo merge and escalation
- memory isolation with explicit transfer rather than implicit global context

Each repo should be treated as a bounded memory domain whose canonical memory
is its files plus git history. Cross-repo reasoning should prefer explicit
context packs, summaries, and reviewed handoffs.

## Writable Surface

Only write within:

- `dev-research/behavioral-factories`
- `scripts/behavioral-factories.ts`
- lane-local grader and verifier surfaces when explicitly needed
- `src/factories`
- `src/inference`
- `src/agent` when simplifying or removing hardcoded paths during promotion-oriented work

Expected lane-local outputs may include:

- `dev-research/behavioral-factories/factories/`
- `dev-research/behavioral-factories/artifacts/`
- `dev-research/behavioral-factories/tests/`
- `dev-research/behavioral-factories/context/`
- `dev-research/behavioral-factories/memory/`

Do not write directly into:

- upstream seed or corpus lanes
- `src/behavioral`
- `src/ui`
- `src/server`
- `skills/`

unless a separate reviewed promotion step explicitly chooses to do so.

## Target Output Shape

This lane should produce deterministic, reviewable outputs such as:

- orchestration factory prototypes
- context pack schemas
- memory item schemas
- rollout and retry strategy artifacts
- validation rule sets
- retained artifact schemas
- training-ready summaries of successful behavioral and MSS patterns
- executable TypeScript factories ready for promotion into `src/factories`
- cleanup plans or patches that remove superseded hardcoded agent behavior

These outputs may be represented as:

- TypeScript
- markdown
- yaml
- json
- jsonl
- archive bundles

Executable TypeScript factories and tests are preferred when the output is
meant to become a real runtime or orchestration surface.

Non-TypeScript formats should usually support:

- retrieval
- provenance
- schema description
- retained artifacts

They should not replace executable factory code by default.

They do not need to default to graph-heavy storage.

## Deterministic Contract

The runtime-facing result should be deterministic for the same inputs.

Deterministic responsibilities:

- preserve the dependency order from seed and corpus into factory outputs
- keep factory outputs stable and reviewable
- encode explicit provenance and retained-artifact structure
- validate behavioral and TypeScript seams

Autoresearch responsibilities:

- propose alternative factory decompositions
- compare memory and retrieval strategies
- compare simpler file-backed context approaches against heavier semantic ones
- judge promotion candidates across attempts

## Validation

Deterministic validation should be preferred for promotion decisions.

Expected checks include:

- `bun scripts/behavioral-factories.ts validate`
- `bun --bun tsc --noEmit` when TypeScript changes
- targeted tests for this lane’s script/test surface
- structural checks over generated behavioral code
- LSP-assisted checks for imports, symbol shape, and known anti-patterns

The lane should fail validation when:

- the program is missing or empty
- required upstream programs or artifacts are missing
- required runtime foundation surfaces are missing
- changed files leave the lane writable surface
- generated outputs cannot be traced back to inputs or retained artifacts

## Execution Contract

When run through autoresearch:

- use worktree-backed isolated attempts
- keep the main repo untouched during attempts
- write durable run artifacts while executing
- run deterministic validation before attempt completion
- prefer reviewable, lane-bounded outputs over broad speculative rewrites

`autoresearch-runner` owns:

- worktree creation
- attempt budgets
- parallel lane instances
- judging and promotion selection

This lane script owns:

- lane contract
- lane-local validation
- lane-local generation helpers

## Success Criteria

An attempt is stronger when it:

- preserves seed/corpus dependency order without reopening raw sources at runtime
- produces factory-oriented artifacts that are easy to inspect and mutate
- clarifies the unit of mutation for the evolving agent package
- improves retrieval, memory packing, rollout control, or validation in a
  concrete way
- makes behavioral programming and MSS easier for the model to internalize
- does not drift into unrelated framework rewrites

## Promotion

Promotion is separate from generation.

Validated attempts may be judged and selected, but the main repo should only
change through explicit promotion of an accepted attempt.
