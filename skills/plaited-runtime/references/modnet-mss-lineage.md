# Modnet / MSS Lineage Reference

This reference keeps lineage context while preserving current runtime doctrine.

## Lineage Summary

- Structural IA and modnet texts provide conceptual lineage for modules,
  boundaries, and composition.
- MSS vocabulary still informs projection semantics and boundary language.
- The old S1-S8 scale ladder is not target Plaited ontology. In the actor era,
  useful scale-like concerns become explicit granularity, containment,
  audience, or projection-scope metadata.

## Current Runtime Translation

Use lineage ideas only after translation through current source:

1. MSS defines what may be projected.
2. Runtime/supervisor decides whether projection is allowed.
3. Protocol adapters expose approved projections.

Plaited's target descriptive tags are `content`, `structure`, `mechanics`, and
`boundary`. Agents can propose facts/resources, services/actions, policies,
and projections, but actors own state and runtime policy decides what crosses
node boundaries. UI is generated locally for each user or agent context.

Protocols (A2A, MCP, WebSocket, Streamable HTTP, and similar adapters) are
mechanics, not ontology.

## Non-Normative Lineage Notes

- Historical modnet and Structural IA phrasing is context, not implementation
  contract.
- Historical `scale` remains in some current schemas for compatibility and
  should be treated as transitional unless source/tests say otherwise.
- Auth/session/token implementation details are not MSS ontology.
- Use `src/agent/*`, `src/modules/*`, and behavioral tests as runtime authority.
