# Node Auth

## Goal

Explore and refine the long-term authentication architecture for Plaited nodes
without overloading `skills/node-auth` with still-unsettled identity and session
policy.

This lane exists to make node authentication a first-class research surface even
before it becomes a fully active autoresearch lane.

## Scope

This program is about:

- authentication strategy by deployment context
- session validation and lifecycle design
- sovereign passkey flows
- hosted/platform token validation
- enterprise SSO and gateway-mediated auth
- how auth state should interact with node memory, governance, and operator control

This program is not primarily about:

- replacing the stable `validateSession` seam documented in `skills/node-auth`
- redefining A2A peer authentication
- shipping final runtime auth code directly from research artifacts

## Inputs

- `skills/node-auth/SKILL.md`
- `skills/modnet-node/SKILL.md`
- `skills/constitution/SKILL.md`
- `skills/agent-loop/SKILL.md`
- `src/server/`
- `src/a2a/`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT-ISOLATION.md`

## Input Priority

Use these inputs with clear precedence:

1. stable runtime code and current auth seams define the existing floor
2. `skills/node-auth` defines the current implementation contract
3. related node, constitution, and agent-loop surfaces clarify where auth fits
4. exploratory policy should be made explicit as proposals rather than treated as already accepted architecture

## External Retrieval

This lane already receives explicit local inputs and lane-provisioned skills.
Treat those as the primary source surface.

External retrieval is allowed only when:

- local auth and identity surfaces are insufficient for a bounded design decision
- multiple local sources conflict and external verification would clarify the tradeoff
- a missing standard, pattern, or deployment precedent must be checked before it is proposed

External retrieval should remain supporting evidence, not the default authoring
surface.

## Expected Outputs

This lane should produce reviewable, lane-local artifacts such as:

- auth architecture notes
- deployment-context strategy comparisons
- session-model proposals
- identity and governance interaction notes
- promotion criteria for future node-auth runtime changes

Those outputs should stay under:

- `dev-research/node-auth/`

## What You Can Edit

- `dev-research/node-auth/program.md`
- lane-local artifacts created under `dev-research/node-auth/`

## What You Cannot Edit

- `src/tools/`
- stable runtime auth code unless a separate reviewed promotion step explicitly broadens scope

## Research Questions

This lane should help answer questions such as:

- what should remain a stable auth seam versus become configurable policy
- how sovereign node auth should differ from hosted and enterprise deployments
- what session state belongs in memory versus ephemeral runtime storage
- how auth should interact with constitution, DAC/MAC policy, and operator approval
- what parts of auth behavior should later become durable memory or training surfaces

## Run Loop

1. Confirm that the relevant auth, node, constitution, and runtime inputs exist.
2. Distinguish the stable seam from unresolved identity and session policy.
3. Produce or revise lane-local research artifacts under `dev-research/node-auth/`.
4. Keep outputs bounded, reviewable, and explicit about deployment assumptions.
5. Promote only accepted conclusions into skills, runtime surfaces, or future lane scripts as a separate step.

## Success Criteria

- the lane produces reviewable auth architecture artifacts
- stable auth seams are separated from still-experimental policy
- outputs improve confidence about the long-term node-auth direction
- future runtime/auth changes have clearer promotion criteria

## Validation

Deterministic checks should verify:

- the program exists and is non-empty
- required local inputs exist
- lane-local outputs stay within `dev-research/node-auth/`

This lane is intentionally a stubbed research surface for now. It exists so the
auth architecture can mature through explicit research and promotion rather than
quietly accreting inside the skill alone.
