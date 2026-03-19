# Modnet Research Program

## Mission

Design the inter-node coordination layer for Plaited after the local framework and native-model lanes are stable.

This program is about:
- sovereign node-to-node coordination
- A2A exchange patterns
- artifact movement across trust boundaries
- enterprise/shared-service modnet structures
- research commons and agent communities across nodes

It is not about local framework refactoring or native-model distillation.

## Separation From Other Programs

- `dev-research/program.md`
  - local framework/runtime/autoresearch infrastructure
- `dev-research/native-model/program.md`
  - Falcon/native-model behavior and distillation
- `dev-research/modnet/program.md`
  - inter-node collaboration, exchange, and governance

Do not merge these concerns casually.

## Core Hypothesis

Plaited nodes should remain sovereign.
Inter-node collaboration should happen through explicit treaty surfaces, not by collapsing nodes into a shared mutable code host.

Therefore:
- A2A remains the external coordination boundary
- PM remains the treaty authority at each node boundary
- shared artifacts move between nodes only through governed exchange

## AgentHub Relevance

AgentHub is useful as inspiration, not as the direct core model.

Useful ideas:
- commit DAGs for collaborative exploration
- frontier/leaves/lineage as agent concepts
- git bundles as transferable code artifacts
- asynchronous message-board style coordination

Non-transferable assumptions:
- agents push freely without sovereign approval
- no main branch / no merge discipline inside a node
- platform-level coordination replacing node-level governance

Plaited should not replace node sovereignty with a free-push hub.

## Working Synthesis

Inside a node:
- local git repos
- worktrees
- node/module `.memory/`
- PM/constitution/boundary policy

Between nodes:
- A2A is the transport and treaty layer
- git bundles are artifacts exchanged through A2A
- receiving nodes decide whether to inspect, simulate, import, or reject

So:
- bundle = artifact
- A2A = inter-node exchange protocol
- PM = import/export/apply authority

## Research Questions

- How should git bundles be represented as A2A artifacts?
- What provenance must accompany bundle exchange?
- How should receiving nodes sandbox and evaluate imported artifacts?
- What is the right model for frontier discovery across sovereign nodes?
- When does a message-board or channel layer help, and when does it duplicate A2A?
- How should enterprise nodes differ from personal nodes?
- How should shared-service nodes expose capabilities without collapsing sovereignty?

## Target Themes

### A2A Artifact Exchange

- git bundles as first-class artifacts
- metadata, provenance, and evaluation summaries attached to artifacts
- import/export policy at node boundaries

### Inter-Node Experiment Sharing

- publish candidate improvements between nodes
- retain lineage of experiment ancestry
- allow nodes to accept/reject/replay external improvements

### Enterprise Modnets

- organizational nodes
- service-account-owned nodes
- shared-service nodes
- treaty boundaries between personal and enterprise nodes

### Research Commons

- optional community layer for agents to share results
- asynchronous collaboration across many sovereign nodes
- DAG-like exploration without requiring a centralized mutable repo

## Acceptance Criteria

A future design in this lane should:

- preserve sovereign node boundaries
- keep A2A as the external exchange boundary
- avoid bypassing PM/constitution authority
- make artifact provenance explicit
- support enterprise/shared-service patterns without collapsing into a central hub

## Safety

Do not allow imported artifacts to bypass:
- constitution
- boundary policy
- promotion policy
- PM approval of external work

Do not treat external bundles as trusted code by default.
