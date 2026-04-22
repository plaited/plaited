# Modnet Translation

> Status: active translation guide. Historical Modnet language is lineage, not
> current runtime contract.

## What Changes

Original Modnet assumed reusable modules could compose into larger shared
interfaces through standardized tags, including `scale`. That was a reasonable
pre-agent framing: interfaces were made from predefined building blocks, and
interoperability needed a way to know where a block could fit.

Plaited changes the interoperability unit. Nodes do not share UI blocks. Nodes
expose approved facts, resources, services, and projections. Local agents render
the UI for their users.

## What Scale Was Doing

`scale` carried at least three separate meanings:

- granularity: what size of thing is this?
- containment: what can it contain or be contained by?
- blast radius: how broad is the social or coordination context?

Those meanings should not remain collapsed into a single S1-S8 hierarchy.

## Target Translation

| Modnet Concept | Plaited Translation |
|---|---|
| Content | Descriptive domain tag plus projectable facts/resources |
| Structure | Descriptive state organization and relationships |
| Mechanics | Actor-owned services/actions and interaction loops |
| Boundary | Runtime policy, projection scopes, grants, audience constraints |
| Scale | Legacy compatibility; replace with explicit metadata when needed |

If granularity or containment matters, put it on the relevant fact, resource,
service, or projection descriptor. Do not require every actor to fit a universal
ladder.

## Current Implementation Gap

Some current schemas still include `scale` for MSS compatibility:

- `src/modules/module-program-admission.ts`
- `src/behavioral/actor-policy-ledger.ts`
- related tests and examples

Until those schemas migrate, docs should call `scale` transitional rather than
target doctrine.

## Migration Direction

The likely migration is:

1. Accept four descriptive tags for new module/program descriptors.
2. Keep legacy `scale` input temporarily as optional compatibility metadata.
3. Move useful scale-like information to structured fields such as
   `granularity`, `containment`, `audienceScope`, or projection `scope`.
4. Update tests and actor policy replay once compatibility behavior is explicit.
