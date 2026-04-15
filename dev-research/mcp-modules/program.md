# MCP Modules

## Goal

Research the smallest effective module architecture around the existing
[src/modules/mcp-module/](../../src/modules/mcp-module) utilities so the default Plaited agent can use
remote MCP servers as bounded discovery and execution surfaces without widening
the core agent engine.

This lane should determine how MCP capabilities become default module-owned
behavior rather than just a raw SDK wrapper.

## Why This Lane Exists

The repo already contains working MCP building blocks under
[src/modules/mcp-module/](../../src/modules/mcp-module), including:

- manifest schemas
- remote manifest fetch and normalization
- streamable HTTP transport creation
- client/session creation
- tool, prompt, and resource listing
- tool calling and resource reading

What is still open is the default-module question:

- how should these MCP capabilities be presented, selected, and used by the
  shipped agent?

The missing work is not another generic client abstraction. The missing work is
policy around:

- discovery
- capability projection
- session reuse
- auth and headers
- timeout/reliability behavior
- prompt/resource/tool composition into local agent context

## Dependency Order

1. [src/agent/create-agent.ts](../../src/agent/create-agent.ts) defines the minimal core boundary
2. GitHub issue-backed module backlog planning owns cross-lane bundle
   decisions
3. [skills/add-mcp/SKILL.md](../../skills/add-mcp/SKILL.md) defines MCP integration patterns
4. [skills/add-remote-mcp/SKILL.md](../../skills/add-remote-mcp/SKILL.md) defines remote MCP wrapper patterns
5. [skills/search-mcp-docs/SKILL.md](../../skills/search-mcp-docs/SKILL.md) defines MCP protocol/source lookup
6. This lane hill-climbs the MCP slice and feeds its winning candidates back
   into GitHub issue-backed module backlog planning

## Core Hypothesis

The protocol/client code under [src/modules/mcp-module/](../../src/modules/mcp-module) is already near the
right engine layer.

The missing work is module-owned composition:

- how remote MCP servers are represented to the model
- when to rely on manifests versus live discovery
- how tools, prompts, and resources should be exposed
- when sessions should be reused versus created ad hoc
- how auth/timeouts/retries should be treated in the default bundle

In other words:

- MCP transport/session mechanics should stay in [src/modules/mcp-module/](../../src/modules/mcp-module)
- default-agent behavior should emerge from judged module composition
- [src/agent](../../src/agent) should not absorb MCP orchestration policy

## Local Inputs

Primary local inputs:

- [src/modules/mcp-module/mcp.schemas.ts](../../src/modules/mcp-module/mcp.schemas.ts)
- [src/modules/mcp-module/mcp.utils.ts](../../src/modules/mcp-module/mcp.utils.ts)
- [src/modules/mcp-module/tests/mcp.manifest.spec.ts](../../src/modules/mcp-module/tests/mcp.manifest.spec.ts)
- [src/modules/mcp-module/tests/mcp.spec.ts](../../src/modules/mcp-module/tests/mcp.spec.ts)
- [src/agent/create-agent.ts](../../src/agent/create-agent.ts)

Reference skills:

- [skills/add-mcp](../../skills/add-mcp)
- [skills/add-remote-mcp](../../skills/add-remote-mcp)
- [skills/search-mcp-docs](../../skills/search-mcp-docs)
- [skills/search-agent-skills](../../skills/search-agent-skills)

Utility skills:

- [skills/typescript-lsp](../../skills/typescript-lsp)

## Product Target

The first shipped MCP module should support:

1. discovering remote MCP server capabilities through manifest fetch or live
   session discovery
2. projecting remote tools, prompts, and resources into a compact local
   capability surface
3. letting the model or a higher-level module choose a remote MCP capability
4. executing that capability through bounded sessions and explicit runtime
   state
5. exposing results back into the agent through clear local signals or events
6. keeping auth, headers, and timeout behavior explicit and reviewable

## Required Architectural Properties

### 1. MCP Is A Capability Source, Not A New Core Runtime

This lane should assume:

- MCP servers are external capability providers
- their use belongs in module-owned policy
- the core agent should not become an MCP-specific orchestration engine

### 2. Discovery Should Be Layered

The current utilities already support a useful layered pattern:

- prefer manifest capabilities when available
- fall back to live session discovery when needed

This lane should preserve that bias and decide how it becomes default behavior.

### 3. Session Lifecycle Should Be Explicit

Candidate modules should make session handling reviewable:

- when a session is created
- when it is reused
- when it is closed
- how timeouts are applied

Avoid hidden long-lived state that only exists inside one helper call chain.

### 4. Tools, Prompts, And Resources Need Different Policies

The module layer should not treat all MCP capability kinds as interchangeable.

Different questions apply to:

- tools
- prompts
- resources

For example:

- tools are executable remote actions
- prompts are context-building assets
- resources are fetchable information surfaces

The default bundle may need different routing and trust rules for each.

### 5. Auth And Headers Are Policy

The MCP helpers already expose headers and OAuth-provider seams. This lane
should decide:

- what the default operator/model surface is
- how auth configuration is stored or injected
- which remote servers are considered trusted enough for default use

## Research Questions

This lane should answer questions such as:

- what is the smallest default MCP module bundle that is genuinely useful?
- should manifest projection and live session execution be one module or
  separate ones?
- should remote MCP capabilities be presented directly to the model or through
  a local mediated abstraction?
- when should prompts/resources be pulled automatically versus on request?
- what timeout and retry behavior is acceptable in the default bundle?
- what evidence is needed before a remote MCP server should be trusted by
  default?

## Candidate Module Hypotheses

### 1. Manifest Projection First

A bundle where the main initial value is compact projection of remote server
capabilities into model-readable metadata.

Hypothesis:

- better capability visibility matters before richer execution policy

### 2. Tool Execution First

A bundle where MCP primarily matters as a remote tool substrate.

Hypothesis:

- the first default need is remote action execution, not prompts/resources

### 3. Prompt/Resource Context First

A bundle where MCP is primarily a context assembly surface, not a remote action
surface.

Hypothesis:

- many useful MCP integrations are really retrieval/context integrations

### 4. Session Pool First

A bundle where the main value is session reuse and remote-capability stability.

Hypothesis:

- session lifecycle is the missing policy layer for practical MCP use in the
  default bundle

## Evaluation Questions

Candidate bundles should be judged on:

- does the design keep [src/agent](../../src/agent) minimal?
- does it separate MCP mechanics from usage policy?
- can the model discover the right remote capability without excessive prompt
  cost?
- are session, timeout, and auth behaviors observable enough to debug?
- does the design treat tools/prompts/resources distinctly where needed?
- is the resulting remote-capability surface understandable enough to ship by
  default?

## Deliverables

This lane should produce:

- candidate module bundles around [src/modules/mcp-module/](../../src/modules/mcp-module)
- integration notes for manifests, sessions, auth, and capability projection
- tests or eval tasks for default MCP behavior
- a recommendation for whether and how MCP should be included in the default
  shipped bundle

## Negative Goal

This lane should not:

- widen [src/agent/create-agent.ts](../../src/agent/create-agent.ts) with MCP-specific orchestration logic
- assume all remote MCP servers are equivalent or equally trusted
- collapse discovery, auth, sessioning, and execution into one opaque helper
- treat MCP as a substitute for the local module/runtime architecture
