# Modnet / MSS Lineage Reference

This reference keeps lineage context while preserving current runtime doctrine.

## Lineage Summary

- Structural IA and modnet texts provide conceptual lineage for modules,
  boundaries, and composition.
- MSS vocabulary still informs projection semantics and boundary language.

## Current Runtime Translation

Use lineage ideas only after translation through current source:

1. MSS defines what may be projected.
2. Runtime/supervisor decides whether projection is allowed.
3. Protocol adapters expose approved projections.

Protocols (A2A, MCP, WebSocket, Streamable HTTP, and similar adapters) are
mechanics, not ontology.

## Non-Normative Lineage Notes

- Historical modnet and Structural IA phrasing is context, not implementation
  contract.
- Auth/session/token implementation details are not MSS ontology.
- Use `src/agent/*`, `src/modules/*`, and behavioral tests as runtime authority.
