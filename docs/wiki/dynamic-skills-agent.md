# Dynamic Skills Agent Model

> Status
>
> - Implemented now: `src/skills` discovers skill envelopes, validates `SKILL.md`, parses `metadata.plaited` from frontmatter when present, and emits a validated capability registry via `plaited skills '{"mode":"registry","rootDir":"..."}'`.
> - Target direction: a behavioral orchestrator consumes the capability registry and compiles it into behavioral specs and handlers.

## Node and Skill Boundary

### Implemented now

- A node is the agent runtime boundary.
- Skills are capability packages inside a node, not independent nodes.
- Skills can be shipped locally or generated locally.

### Target direction

- Node runtime authority remains local.
- Skill packages remain structural wrappers that supply capability definitions to orchestrators.
- Authority comes from local generated/shipped skill envelopes, not arbitrary remote skill-package installation.

## Skill Envelope Shape

Skill envelopes may contain:

- required `SKILL.md`
- optional `metadata.plaited` in `SKILL.md` frontmatter
- scripts
- resources
- assets
- UI artifacts
- behavioral spec artifacts
- tests

Capabilities are the addressable units inside a skill envelope and are emitted as namespaced addresses (for example `<skill-name>/<capability-id>`).

## `src/skills` Ownership

### Implemented now

- skill discovery under workspace skill directories
- `SKILL.md` frontmatter validation
- generated-manifest parsing and validation (`SKILL.md` frontmatter `metadata.plaited`)
- capability registry emission for CLI consumption

### Not in `src/skills`

- behavioral spec compilation
- runtime orchestration
- capability execution scheduling

`src/skills` is a registry/discovery boundary, not the orchestrator.

## Dual-Lane Capability Relationship

- `private` lane capabilities are local read/context/execution surfaces governed by local node policy.
- `exchange` lane capabilities require boundary contracts before external exposure.

Lane labels are metadata until enforced by runtime policy and contract evaluation surfaces.

## MCP-Backed Skill Generation (Target Flow)

1. Inspect remote MCP URL and discover exposed tools/resources.
2. Classify source provenance and authentication requirements.
3. Propose a curated local skill envelope and capability set.
4. Require explicit user review/approval.
5. Generate local wrappers/scripts/tests plus optional `metadata.plaited` in `SKILL.md` frontmatter.
6. Validate envelope + manifest.
7. Register capabilities through `src/skills` registry emission.

Normative guardrail: do not mirror all remote MCP tools by default. Generate only curated capabilities approved for local policy and lane posture.

## Current vs Target Direction

### Implemented now

- `plaited skills '{"mode":"registry","rootDir":"..."}'` emits validated capability registry entries from local skill envelopes.

### Target direction

- behavioral orchestrator compiles registry entries into behavioral specs and handlers, then executes under lane and boundary policy.

## Related

- [Architecture](architecture.md)
- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
