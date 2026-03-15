# Project Isolation

> **Status: ACTIVE** — Implementation patterns moved to `skills/project-isolation/`. This document retains design rationale only.

## Why Process Isolation

A single agent may work across multiple projects — separate git repositories, different codebases, distinct security contexts. These need **hard process boundaries**, not logical partitioning.

Logical separation (namespaces, in-process modules) is insufficient: a bug in one project's tool execution can corrupt another project's state, a crash takes down all projects, and memory isolation requires discipline rather than enforcement. Process boundaries provide OS-level guarantees.

## Isolation Guarantees

| Concern | Solution |
|---|---|
| **Memory isolation** | Each subprocess has its own address space. Project A's memory cannot leak to Project B. |
| **Crash containment** | A failing subprocess doesn't take down the orchestrator or other projects. |
| **Security boundaries** | Each subprocess runs with its own sandbox profile. Different projects can have different capability restrictions. |
| **Network proxy** | Subprocesses have no outbound network. All network requests are IPC events to the orchestrator, which proxies after BP gate approval. |
| **Independent lifecycle** | Projects can be started, stopped, and restarted independently. |
| **Event log partitioning** | Each subprocess's `useSnapshot` callbacks produce JSON-LD files in project-scoped directories. |

## Implementation

See **[skills/project-isolation/](../skills/project-isolation/SKILL.md)** for:
- Orchestrator + subprocess architecture (Mermaid diagram)
- IPC trigger bridge code patterns
- Tool layer assembly (framework → global → project)
- Constitution loading at spawn
- Two levels of Bun.spawn (project subprocess vs sub-agent)
- Cross-project knowledge transfer

## Cross-References

- `SAFETY.md` — sandbox Layer 2
- `CONSTITUTION.md` — constitution loading
- `HYPERGRAPH-MEMORY.md` — event log partitioning via JSON-LD
