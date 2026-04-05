# Skill Factories

## Goal

Define the first default factory for the Plaited agent:

- [src/factories/skills-factory/skills-factory.ts](../../src/factories/skills-factory/skills-factory.ts)

This lane should turn the current placeholder factory plus working
skill-discovery utilities into a real bounded factory surface without
pretending the full selection/injection policy stack already exists.

Near-term work should bias toward the smallest promotable production slice:

- real behavior in `skills-factory.ts`, not utility-only churn
- local skill discovery
- frontmatter and link validation
- structured catalog state
- bounded tests around those behaviors

The first slice should make the factory observably non-placeholder. Good first
slices include:

- loading discovered/validated local skills into signals at factory startup
- exposing a compact signal-backed skill catalog
- publishing invalid-skill state for debugging

Defer broader model-time selection, body injection, and follow-up execution
policy unless that smaller factory-owned catalog/state layer is already real.

This lane translates the `plaited/example-agent` skill behavior into the
current minimal-core + behavioral-factory architecture.

## Why This Lane Exists

The current agent core already provides:

- runtime factory installation via `update_factories`
- internal event routing through `behavioral()`
- built-in handlers for:
  - `read_file`
  - `write_file`
  - `delete_file`
  - `glob_files`
  - `grep`
  - `bash`
  - primary / tts inference requests
- signal-backed result delivery

What is still missing is the policy layer that makes skills usable to the
model.

That missing behavior includes:

- discovering shipped and workspace-local `SKILL.md` files
- validating frontmatter and local references
- storing skill metadata and bodies in signals
- presenting a compact skill catalog to the model for search / selection
- reacting when the model elects a skill
- injecting the chosen skill body into context
- resolving local markdown links and executable script references on demand
- letting the model continue through ordinary core tools such as `read_file`
  and `bash`

This is a natural first default factory because it gives the agent a policy
surface for using the repo's own implementation knowledge without expanding
`createAgent()` itself.

## Current Implemented Surface

The current code under
[src/factories/skills-factory/](../../src/factories/skills-factory/) is much
narrower than the end-state target:

- [src/factories/skills-factory/skills-factory.ts](../../src/factories/skills-factory/skills-factory.ts)
  is still a placeholder factory that returns an empty object
- [src/factories/skills-factory/skills-factory.utils.ts](../../src/factories/skills-factory/skills-factory.utils.ts)
  already provides real utility behavior for:
  - frontmatter validation
  - workspace skill directory discovery
  - local-link validation
- existing tests are utility-only:
  - [src/factories/skills-factory/tests/skills-factory.utils.spec.ts](../../src/factories/skills-factory/tests/skills-factory.utils.spec.ts)

Treat that as the source of truth for planning. A good first attempt on this
lane should usually turn the placeholder factory into one bounded real factory
behavior on top of the existing utilities, not jump straight to a full
behavior-rich skill-selection system and not stop at utility-only expansion.

## Relationship To Other Lanes

This lane is a focused subprogram under:

- [dev-research/default-factories/program.md](../default-factories/program.md)

It should stay aligned with:

- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)

It should compose with:

- [dev-research/search-factories/program.md](../search-factories/program.md)
- [dev-research/module-discovery-factories/program.md](../module-discovery-factories/program.md)

It is expected to inform the default factory bundle decision, but it should
remain a bounded surface:

- discovery
- validation
- selection
- context projection
- skill-linked file and script activation

This lane should not absorb unrelated planning, memory, notification, or
general execution-routing policy.

In particular, broader internal/external retrieval orchestration should belong
to `search-factories`, not to this lane alone.

## Local Inputs

Primary local inputs:

- [src/factories/skills-factory/skills-factory.ts](../../src/factories/skills-factory/skills-factory.ts)
- [src/factories/skills-factory/skills-factory.utils.ts](../../src/factories/skills-factory/skills-factory.utils.ts)
- [src/factories.ts](../../src/factories.ts)
- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)
- [src/agent/agent.types.ts](../../src/agent/agent.types.ts)
- [src/agent/agent.schemas.ts](../../src/agent/agent.schemas.ts)
- [src/agent/agent.constants.ts](../../src/agent/agent.constants.ts)
- [src/utils/markdown.ts](../../src/utils/markdown.ts)
- `skills/`

Important utility surfaces already present:

- `SkillFrontMatterSchema` in [src/factories/skills-factory/skills-factory.utils.ts](../../src/factories/skills-factory/skills-factory.utils.ts)
- `findSkillDirectories(...)`
- `isValidSkill(...)`
- `validateSkillLocalLinks(...)`
- `parseMarkdownWithFrontmatter(...)` in [src/utils/markdown.ts](../../src/utils/markdown.ts)
- `extractLocalLinksFromMarkdown(...)` in [src/utils/markdown.ts](../../src/utils/markdown.ts)

## External Reference Inputs

Use `gh` as the source of truth for the reference implementation:

- `https://github.com/plaited/example-agent/tree/main/src/tools/SkillTool`
- `https://github.com/plaited/example-agent/tree/main/src/skills`

The most relevant reference files are:

- [src/tools/SkillTool/SkillTool.ts](../../src/tools/SkillTool/SkillTool.ts)
- [src/tools/SkillTool/prompt.ts](../../src/tools/SkillTool/prompt.ts)
- [src/skills/loadSkillsDir.ts](../../src/skills/loadSkillsDir.ts)

These references matter because they already capture:

- compact skill listing for model discovery
- deferred loading of full skill bodies until selection time
- frontmatter parsing and skill metadata extraction
- direct injection of selected skill content into model context
- link and script expansion after a skill is selected

## Core Hypothesis

The best skill-factory design should follow this split:

- `createAgent()` remains the execution boundary
- the skill factory owns skill discovery, selection policy, and context
  assembly
- built-in core handlers continue to perform file reads, bash execution, and
  model inference
- signals hold skill state and provide observable handoff points between
  behavioral rules and side-effect handlers

Stated differently:

- skills should become agent behavior through factories

## Product Target

The eventual shipped skill factory should support this end-to-end flow:

1. discover workspace-local skills under `**/skills/*/SKILL.md`
2. parse and validate frontmatter and body
3. validate local markdown links
4. store structured skill metadata in signals
5. expose a compact catalog of skill names and descriptions to the model
6. let the model indicate that it wants to use a specific skill
7. inject the selected skill body into the active model context
8. when the model asks for a linked file or script, route through existing
   `read_file` or `bash` core events rather than ad hoc loaders

This should be enough to let the model move from:

- "I see there is a skill"

to:

- "I want to use that skill"

to:

- "I need this linked file / script from that skill"

without adding a second execution system.

The first promotable slice for this lane does not need to deliver the whole
flow above. It is enough to land concrete factory-era progress such as:

- stronger validated skill records and schemas
- tighter workspace discovery rules
- explicit error/state surfaces around invalid skills
- a minimal non-placeholder factory shape with observable signals
- focused tests that prove one bounded behavior end to end

The key bar is that the attempt must advance the factory surface itself, not
only add more helper coverage around existing utilities.

## Required Architectural Properties

### 1. Discovery Is Metadata-First

Skill discovery should not eagerly inject every full `SKILL.md` body into the
prompt.

The first stage should expose only a compact catalog, likely derived from:

- skill path
- skill name
- description
- optional compatibility / allowed-tools metadata

This follows the `example-agent` pattern where a listing prompt is compact and the
full body is loaded only after selection.

### 2. Selection Is A Behavioral Event

Skill use should be modeled as agent events and bThread coordination, not as a
single imperative helper hidden in one function.

The factory should likely introduce events for moments such as:

- skill catalog loaded
- skill validation failed
- skill requested
- skill selected
- skill body loaded
- skill link requested
- skill script requested

Exact names are open research, but the shape should remain event-driven.

### 3. Signals Hold Working Skill State

Signals should carry at least:

- discovered skill catalog
- validation outcomes
- selected skill identity
- selected skill body
- link resolution state
- any derived prompt/context fragments needed for inference

Validation and parsing should not only return booleans. They should produce
reusable state that later rules and handlers can consume.

### 4. Read / Bash Stay In The Core

The skill factory should not add its own bespoke file execution stack.

If a selected skill references:

- a markdown file
- a schema
- an asset path
- a script under `scripts/`

the factory should route through the existing core events and handlers where
possible:

- `read_file`
- `glob_files`
- `bash`

That preserves the architecture work already done in [src/agent/create-agent.ts](../../src/agent/create-agent.ts).

### 5. Selection Should Be Model-Assisted But Policy-Owned

The model can choose a skill, but the factory should own:

- what metadata is exposed for search
- how selection is represented
- what is injected after selection
- what follow-up link/script access is permitted or encouraged

This should not collapse into "dump all skills into the prompt and hope."

## Non-Goals

This lane should not:

- make every skill a top-level CLI command
- bypass the existing core event and signal architecture
- eagerly load all linked files for every discovered skill
- solve the entire planning or tool-orchestration problem
- assume remote skill marketplaces are required for the first shipped version

## Key Translation Problem From `example-agent`

The `example-agent` surfaces mix together several concerns:

- skill discovery
- skill prompt-budget formatting
- command/tool wrapper behavior
- context injection
- remote skill loading
- permissions and policy details specific to that runtime

This lane should separate those concerns for Plaited:

- discovery and validation in utility/helpers
- state retention in signals
- sequencing in behavioral rules
- side effects in handlers
- built-in IO and execution in the core

The research challenge is how to keep its good ideas while fitting them to the
current runtime model.

## Candidate Factory Responsibilities

The mature factory candidate should likely own:

- startup discovery of local skills
- re-discovery when factories or relevant workspace content change
- signal population for skill catalog and validation results
- a compact prompt fragment for skill search / selection
- event handling when a model chooses a skill
- body injection for the selected skill
- link extraction from the selected skill body
- follow-up routing for local linked files and executable scripts

Open question:

- whether skill selection is represented as a direct model tool call, a tagged
  message convention, or a BP event emitted by another factory

This lane should answer that experimentally.

For near-term attempts, prefer one bounded responsibility at a time. Good
examples:

- add missing schemas/types around discovered and invalid skills
- introduce a minimal signal-backed catalog without full selection policy
- improve local-link and skill-directory qualification rules when they directly
  support the factory-owned catalog flow
- add one narrow integration test from placeholder factory to utility state

Avoid plans that require discovery, selection, injection, linked-file routing,
and script execution all in one slice.
Also avoid plans that only add utility helpers or utility-only test files
without making `skills-factory.ts` more real.

## Candidate Data Surfaces

The lane should define concrete data shapes for at least:

- discovered skill summary
- validated skill record
- invalid skill record
- selected skill state
- linked file reference
- executable script reference
- injected context fragment

These may be schema-first if they are plain data crossing event boundaries.
The factory itself and its live signal objects should remain type-first.

## Evaluation Questions

Candidate designs should be judged on:

- can the model reliably discover the right skill from compact metadata
- can the model select a skill without requiring the full skill body up front
- does selected-skill injection improve task performance without excessive
  token cost
- can the model correctly follow links into supporting files
- can the model correctly route to `read_file` and `bash` through the existing
  core
- does the design preserve a clean engine-versus-policy split
- is the resulting factory understandable enough to ship by default

## Comparison Dimensions

The lane should compare at least these design axes:

- eager full-body loading vs deferred body loading
- direct selection tool vs event-driven selection message
- skill-body injection as one meta message vs segmented context fragments
- immediate linked-file expansion vs model-requested follow-up expansion
- always-on workspace scan vs scoped / cached discovery

## Deliverables

This lane should produce:

- incremental evolution of the executable factory at [src/factories/skills-factory/skills-factory.ts](../../src/factories/skills-factory/skills-factory.ts)
- any supporting schemas, constants, and tests under
  [src/factories/skills-factory/](../../src/factories/skills-factory)
- retained notes on which `example-agent` behaviors were adopted or reshaped
- a clear recommendation on whether this factory should be included in the
  default shipped bundle

## Initial Implementation Bias

The first implementation pass should bias toward:

- local skills only
- compact metadata catalog first
- a minimal non-placeholder `skills-factory.ts` that owns signal/state setup
- utility and schema progress before broad behavioral selection flow
- deferred body loading on selection only after catalog/state scaffolding exists
- link extraction through [src/utils/markdown.ts](../../src/utils/markdown.ts)
- validation side effects stored in signals
- existing `read_file` and `bash` core handlers for follow-up execution

This is the narrowest path that still captures the core value of
`SkillTool` / `loadSkillsDir` behavior inside the current Plaited
architecture.
