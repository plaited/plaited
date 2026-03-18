# Slice 3

## Target

Introduce explicit actor, sub-agent, and team integration on top of the runtime taxonomy.

## Scope

- `src/runtime/*`
- one integrated runtime path
- minimal supporting changes in `src/agent/*` or `src/modnet/*` only if required

## Required

- explicit actor/sub-agent/team runtime types are usable in code
- one path starts relaxing PM-mediated routing toward direct actor-to-actor messaging
- PM remains authority, not mandatory relay

## Preserve

- A2A still terminates at PM/node boundary first
- constitution, boundary policy, promotion policy, and external treaty behavior remain PM-owned

## Avoid

- broad A2A redesign
- broad `createNode` or `createAgentLoop` rewrite
- introducing package = module = actor coupling

## Acceptance Criteria

- one integrated actor/sub-agent/team path exists
- direct actor messaging begins to work without bypassing policy
- validation passes
