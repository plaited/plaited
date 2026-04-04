# Search Factories

## Goal

Research the first default search-oriented factory bundle for the Plaited
agent.

This lane should define how the agent:

- searches internal repo and runtime surfaces
- invokes external search when internal knowledge is insufficient
- routes among search backends
- projects search results into model context
- grounds downstream module, factory, and tool decisions in retrieved evidence

The first shipped search factory should treat search as a policy surface, not
as a loose collection of unrelated tools.

## Why This Lane Exists

Small and medium local models should not be expected to know everything.

The repo already has or is expected to have multiple search surfaces:

- file and content search over the workspace
- git-aware search and history lookup
- skill discovery and skill-linked content lookup
- module and factory discovery
- memory and snapshot-derived retrieval
- external web search through skills such as `youdotcom`

What is missing is the orchestration layer that decides:

- when search is needed
- which search surface should be used
- how results should be compressed into context
- how evidence should influence later calls and outputs

This lane exists so search policy does not get buried partially inside
skill-factory, module-discovery-factory, memory-factory, or ad hoc prompts.

## Relationship To Other Lanes

This lane is a focused subprogram under:

- [dev-research/default-factories/program.md](../default-factories/program.md)

It should integrate with:

- [dev-research/skill-factories/program.md](../skill-factories/program.md)
- [dev-research/module-discovery-factories/program.md](../module-discovery-factories/program.md)
- [dev-research/memory-factories/program.md](../memory-factories/program.md)
- [dev-research/three-axis-factories/program.md](../three-axis-factories/program.md)
- [dev-research/agent-harness-research/program.md](../agent-harness-research/program.md)

The intended split is:

- `search-factories` owns search orchestration and retrieval policy
- `skill-factories` owns skill discovery and activation
- `module-discovery-factories` owns module qualification and load policy

The `youdotcom` skill should be treated as a concrete external search tool
surface, not as a standalone architecture lane.

## Core Hypothesis

The best default search behavior will come from a dedicated search factory that
unifies internal and external retrieval under one compact policy surface.

That means:

- search should not be modeled as raw tool clutter in the prompt
- internal search and external search should be routable under one policy
- the factory should expose concise search results, not entire raw logs
- search should improve downstream module and factory selection rather than end
  at citation alone

## Product Target

The first shipped search factory bundle should support:

1. deciding whether the current task needs search
2. classifying the search need, for example:
   - internal repo search
   - skill search
   - module or factory discovery
   - snapshot or memory search
   - external web search
3. invoking the right search surface
4. producing compact search-result summaries for model-time use
5. preserving enough provenance for citations, inspection, and replay
6. feeding retrieved evidence into later module, factory, and tool decisions

## Search Classes

### 1. Internal Structural Search

Examples:

- workspace file search
- grep and symbol search
- git history search
- skill metadata search
- module metadata search

This class is mainly about finding local implementation knowledge and runtime
structure.

### 2. Runtime Context Search

Examples:

- memory search
- snapshot-derived trace search
- signal-adjacent state lookup

This class is mainly about retrieving local agent context and prior behavior.

### 3. External Knowledge Search

Examples:

- cited web search through the `youdotcom` skill
- later external research or extraction surfaces

This class is mainly about filling knowledge gaps and grounding claims that the
local model should not guess.

## Required Architectural Properties

### 1. Search Is A Factory Surface

This lane should avoid scattering search policy across:

- prompts alone
- skills alone
- memory alone
- module discovery alone

The factory should provide one coherent search orchestration layer.

### 2. Search Should Remain Backend-Neutral

The default policy should be able to route among:

- internal repo search
- internal runtime search
- external web search

without hard-coding the architecture to one provider.

### 3. External Search Should Stay Tool-Shaped

External search providers such as `youdotcom` should remain concrete skills or
tool surfaces under the search factory.

The search factory should decide:

- when to call them
- what query to send
- how many results to keep
- how to summarize them into context

### 4. Search Must Support Downstream Action

The goal is not only to retrieve citations.

Search should support:

- correct module and factory selection
- better task decomposition
- better verification and simulation inputs
- better grounded final outputs

### 5. Search Should Be Reviewable

Candidate designs should make it easy to inspect:

- what search class was chosen
- which backend was called
- what evidence was retained
- what downstream decision the search informed

## Research Questions

This lane should answer:

- what is the smallest coherent search policy surface?
- how should search be represented in signals?
- how should search results be retained or summarized?
- when should the model search versus rely on local symbolic knowledge?
- how should internal search and external search be blended?
- how should search output feed into module and factory generation?
- which search traces are worth retaining for later model adaptation?

## Candidate Factory Hypotheses

### 1. Internal-First Search

Hypothesis:

- the best default policy tries local structural and runtime search before
  external search

### 2. Need-Class Routing

Hypothesis:

- the best policy first classifies the type of search need, then chooses a
  backend

### 3. Summary-First Projection

Hypothesis:

- compact summarized search evidence is more useful than dumping raw search
  output into model context

## Deliverables

This lane should produce:

- candidate search factory bundles
- eval tasks for internal and external search routing
- integration notes with skill-factory and module-discovery-factory
- retained search traces suitable for a later training corpus
- a recommendation for what should ship in the default search bundle
