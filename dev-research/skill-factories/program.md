# Skill Factories

## Goal

Define the first default factory for the Plaited agent:

- `src/factories/skills-factory/skills-factory.ts`

This factory should load local skills from the workspace, expose enough skill
metadata for model-time discovery, and then progressively inject the selected
skill body and referenced assets into the model context through the existing
agent core.

The point of this lane is not to recreate the older `SkillTool` surface as a
top-level monolith. It is to translate the useful behavior from
`plaited/example-agent` into the current minimal-core + behavioral-factory
architecture.

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
  - primary / vision / tts inference requests
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

## Relationship To Other Lanes

This lane is a focused subprogram under:

- `dev-research/default-factories/program.md`

It should stay aligned with:

- `src/agent/create-agent.ts`

It is expected to inform the default factory bundle decision, but it should
remain a bounded surface:

- discovery
- validation
- selection
- context projection
- skill-linked file and script activation

This lane should not absorb unrelated planning, memory, notification, or
general execution-routing policy.

## Local Inputs

Primary local inputs:

- `src/factories/skills-factory/skills-factory.ts`
- `src/factories/skills-factory/skills-factory.utils.ts`
- `src/factories.ts`
- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`
- `src/agent/agent.constants.ts`
- `src/utils/markdown.ts`
- `skills/`

Important utility surfaces already present:

- `SkillFrontMatterSchema` in `src/factories/skills-factory/skills-factory.utils.ts`
- `findSkillDirectories(...)`
- `isValidSkill(...)`
- `validateSkillLocalLinks(...)`
- `parseMarkdownWithFrontmatter(...)` in `src/utils/markdown.ts`
- `extractLocalLinksFromMarkdown(...)` in `src/utils/markdown.ts`

## External Reference Inputs

Use `gh` as the source of truth for the legacy reference implementation:

- `https://github.com/plaited/example-agent/tree/main/src/tools/SkillTool`
- `https://github.com/plaited/example-agent/tree/main/src/skills`

The most relevant reference files are:

- `src/tools/SkillTool/SkillTool.ts`
- `src/tools/SkillTool/prompt.ts`
- `src/skills/loadSkillsDir.ts`

These references matter because they already capture:

- compact skill listing for model discovery
- deferred loading of full skill bodies until selection time
- frontmatter parsing and skill metadata extraction
- direct injection of selected skill content into model context
- link and script expansion after a skill is selected

## Core Hypothesis

The best skill-factory design will preserve the current architecture if it
follows this split:

- `createAgent()` remains the execution boundary
- the skill factory owns skill discovery, selection policy, and context
  assembly
- built-in core handlers continue to perform file reads, bash execution, and
  model inference
- signals hold skill state and provide observable handoff points between
  behavioral rules and side-effect handlers

Stated differently:

- skills should become agent behavior through factories
- not through a recreated `src/tools/SkillTool` runtime tier

## Product Target

The first shipped skill factory should support this end-to-end flow:

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

That preserves the architecture work already done in `src/agent/create-agent.ts`.

### 5. Selection Should Be Model-Assisted But Policy-Owned

The model can choose a skill, but the factory should own:

- what metadata is exposed for search
- how selection is represented
- what is injected after selection
- what follow-up link/script access is permitted or encouraged

This should not collapse into "dump all skills into the prompt and hope."

## Non-Goals

This lane should not:

- recreate the old slash-command runtime as a separate subsystem
- make every skill a top-level CLI command
- bypass the existing core event and signal architecture
- eagerly load all linked files for every discovered skill
- solve the entire planning or tool-orchestration problem
- assume remote skill marketplaces are required for the first shipped version

## Key Translation Problem From `example-agent`

The old `example-agent` surfaces mix together several concerns:

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

The research challenge is not whether `example-agent` is useful. It is how to keep
its good ideas while removing assumptions from its older runtime model.

## Candidate Factory Responsibilities

The first factory candidate should likely own:

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

- the executable factory at `src/factories/skills-factory/skills-factory.ts`
- any supporting schemas, constants, and tests under
  `src/factories/skills-factory/`
- retained notes on which `example-agent` behaviors were preserved, changed, or
  rejected
- a clear recommendation on whether this factory should be included in the
  default shipped bundle

## Initial Implementation Bias

The first implementation pass should bias toward:

- local skills only
- compact metadata catalog first
- deferred body loading on selection
- link extraction through `src/utils/markdown.ts`
- validation side effects stored in signals
- existing `read_file` and `bash` core handlers for follow-up execution

This is the narrowest path that still captures the core value of the old
`SkillTool` / `loadSkillsDir` behavior inside the current Plaited architecture.
