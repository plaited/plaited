# Sources

> Status
>
> - Implemented now: source authority comes from `src/`, tests, `AGENTS.md`, and active skill surfaces.
> - Target direction: doctrine pages in this wiki describe dual-lane + BCG + node-auth direction without claiming unimplemented runtime behavior.

## Local Source Authority

### Implemented now

- `src/behavioral/*` and `src/behavioral/tests/*`: runtime coordination and diagnostics baseline.
- `src/ui/*`: local projection/runtime surfaces.
- `src/mcp/*`: MCP schemas/utilities including auth-related schema surfaces.
- `src/worker/*`: worker runtime boundaries.
- `skills/plaited-runtime/SKILL.md`: active runtime doctrine guidance.

### Target direction

- [Dual-Lane HyperNode Model](dual-lane-node-model.md)
- [Boundary Contract Graph](boundary-contract-graph.md)
- [Node-To-Node Auth](node-to-node-auth.md)
- [Dynamic Skills Agent Model](dynamic-skills-agent.md)

These are active doctrine targets and must be read as target direction unless directly backed by current `src/` + tests.

## Lineage Sources (Non-Normative)

- Rachel Jaffe, "Past the Internet: The Emergence of the Modnet", February 3, 2020.
- Rachel Jaffe, "Modnet Design Standards", February 3, 2020.
- Rachel Jaffe, "Current Frameworks of Information Architecture", July 11, 2019.
- Rachel Jaffe, "Development of a new language for Information Architecture", July 18, 2019.
- Rachel Jaffe, "A unified language for the design of information systems", June 11, 2019.

Lineage informs vocabulary and migration context. It is not active runtime contract law.

## External Research Notes

- [Chroma Context-1](chroma-context-1.md)
- [Embarrassingly Simple Self-Distillation](embarrassingly-simple-self-distillation.md)

These are research references, not implementation claims.

## Method

When documentation and code differ:

1. `src/` + tests win.
2. `AGENTS.md` operational instructions win over wiki prose.
3. Skills define operational doctrine for agent work.
4. Wiki pages synthesize and cross-link current vs target direction.
