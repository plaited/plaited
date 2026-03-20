# Skills and Modules

> **Status: ACTIVE** — Doctrine note for how skills and modules relate inside Plaited. Cross-references: `MODNET-IMPLEMENTATION.md` (node/module topology), `HYPERGRAPH-MEMORY.md` (memory layering), `AGENT-LOOP.md` (runtime execution), `dev-research/` (current program lanes).

## Summary

Skills and modules are not the same thing.

- A **skill** is an agent-facing operational capability described in AgentSkills format.
- A **module** is an internal node artifact: code, data, UI, tools, bThreads, and memory that live inside the node's workspace.

Modules are what the node owns and runs.
Skills are how agents learn to create, inspect, improve, validate, and operate those modules.

This distinction aligns with the AgentSkills specification:
- skills are portable operational instructions and executable helpers
- modules are sovereign internal packages within the node

## Roles

| Layer | What it contains | Role |
|---|---|---|
| `src/` | Runtime, A2A, MCP, UI, node machinery | Framework substrate |
| `skills/` | Agent-facing workflows, templates, operational scripts | Reusable competence |
| `modules/` | Domain artifacts inside a node | Productive capability |
| `.memory/` | Node/module decision history and provenance | Operational record |

## Skills

Skills provide reusable agent competence.

They are the layer where Plaited captures:
- generation workflows
- validation procedures
- integration patterns
- operational tools
- adaptation guidance for external protocols

Examples:
- `modnet-modules` teaches module generation patterns
- `mss-vocabulary` constrains valid module bridge-code tags
- `modnet-node` teaches node and module topology
- `add-mcp` and `add-remote-mcp` teach MCP integration patterns

Skills are portable and AgentSkills-aligned.
They are not the source of truth for core runtime behavior.

## Modules

Modules are sovereign internal packages inside a node's workspace.

A module may include:
- server or client code
- data
- UI
- bThreads
- tools
- module-local `.memory/`
- one or more skills that describe how to use or extend it

Modules are not published as raw internals over the network.
Nodes expose services and artifacts through A2A.

This matches `MODNET-IMPLEMENTATION.md`:
- modules stay internal
- Agent Card projects capabilities, not internals
- outputs cross the boundary, not the whole module by default

## The Relationship

The practical relationship is:

- framework defines what is possible
- skills define how agents do the work
- modules are the artifacts produced and operated through that work

So:
- modules are **what gets built**
- skills are **how agents know how to build and work on them**

This is why skills sit across the full lifecycle:
- create a module
- improve a module
- test a module
- integrate a module with external systems
- operate a module over time

## Module-Local Skills

A module may carry its own skill surface.

That skill surface can describe:
- how to extend the module
- how to query it
- how to maintain it
- what workflows are valid around it

This does not make the skill the module.
It makes the skill the module's agent-facing operating manual and helper surface.

## Memory and Provenance

The distinction also matters for memory.

- **Framework repo skills** capture reusable competence and patterns
- **Node/module `.memory/`** captures operational history and decisions

In node deployments:
- module memory travels with the module
- node memory coordinates across modules

So a skill may teach an agent how to improve a module, but the actual record of that improvement
belongs in the module or node `.memory/`, not in the skill definition itself.

## Relation to Current Research Programs

The current research split reinforces this doctrine:

### Framework Program

`dev-research/program.md`

Builds the substrate that modules will rely on:
- runtime taxonomy
- links
- actors, sub-agents, teams
- local attempt lineage

Skills consume and operationalize this substrate.

### Native-Model Program

`dev-research/native-model/program.md`

Teaches the native model to generate and improve modules end-to-end.

Skills provide the reusable workflows and eval framing that help the model act competently.
Modules are the concrete outputs of that competence.

### Modnet Program

`dev-research/modnet/program.md`

Governs inter-node coordination and artifact exchange.

Skills can teach how to package, validate, and exchange artifacts.
Modules remain sovereign internal artifacts unless explicitly exported through governed channels.

## Architectural Rule

Do not collapse skills and modules into one concept.

- If something is reusable agent guidance or an operational helper, it belongs in `skills/`.
- If something is a sovereign internal package or product artifact, it belongs in `modules/`.
- If something is shared runtime substrate, it belongs in `src/`.

This keeps the architecture legible:
- `src/` is the substrate
- `skills/` is the reusable operational layer
- `modules/` is the productive internal layer

## AgentSkills Alignment

This doctrine is intentionally compatible with the AgentSkills specification.

Skills remain:
- portable
- inspectable
- agent-facing
- composed of markdown, references, assets, and scripts

Plaited does not redefine modules as skills.
Instead, Plaited uses skills as the portable operational layer that helps agents create and work
with sovereign modules correctly.
