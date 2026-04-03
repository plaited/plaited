# Plaited Agent Infrastructure

> **Status: ACTIVE** — Proposed deployment architecture for local-first,
> cloud-synced Plaited agents. This document describes an infrastructure target,
> not a claim that the full stack is already implemented in `src/`.

## Goal

Define a deployment model where a personal agent is:

- local-first by default
- portable across machines
- safe to grant execution power
- durable across restarts
- optionally cloud-synced without making cloud residency mandatory

The core idea is to separate three concerns:

- **Cognitive layer**: the LLM-facing agent runtime and policy
- **Execution layer**: a sandbox for running code and tools
- **Persistence layer**: a durable, queryable record of the agent's world state

Plaited stays deployment-agnostic at the framework layer. This document
describes one concrete infrastructure shape that fits the current agent and
factory direction.

This document is intended to be validated by the bootstrap CLI surface:

- `plaited bootstrap`

## Stack

### Cognitive Layer

The cognitive layer is the Plaited agent itself:

- `src/agent/create-agent.ts` provides the minimal execution core
- factories add memory, tools, transport, and policy
- snapshots retain observable execution state
- the model remains replaceable

This layer decides what to do. It does not need direct host-level access to do
it.

### Persistence Layer: AgentFS

The persistence layer is a single durable agent state store, modeled here as an
`agent.db` file backed by AgentFS.

It should hold:

- long-term key-value state such as preferences and retained summaries
- workspace files for the agent's virtual home directory
- tool-call and execution traces for auditability and recovery
- task and queue state for resumable execution

The important property is not the exact storage engine name. The important
property is that agent state is:

- local
- structured
- portable
- incrementally mutable
- queryable

The default shape is a single-file local store that can later be replicated to
private cloud infrastructure such as Turso/libSQL.

## Execution Layer: Boxer

The execution layer is an isolated runtime, modeled here as Boxer/WasmBox.

Its job is to run generated code and file-processing tasks with:

- no implicit host filesystem access
- no implicit network access
- explicit capability grants
- fast startup and teardown
- deterministic behavior across host environments

This layer should be treated as ephemeral compute. The sandbox can disappear
after each task because durable state lives in the persistence layer rather than
inside the sandbox itself.

## Execution Loop

The intended execution loop is:

1. The user or scheduler triggers a task.
2. The orchestrator loads the relevant state from `agent.db`.
3. The orchestrator mounts or exposes that state to the sandbox as the agent's
   working filesystem.
4. The Plaited agent reasons over recent context, retained memory, and current
   task state.
5. Generated code or tools run inside the sandbox.
6. The sandbox reads and writes through the mounted AgentFS view.
7. The sandbox exits.
8. Mutations remain durable in `agent.db`.
9. Replication pushes the updated state to other trusted devices when enabled.

The key split is:

- execution is ephemeral
- memory is durable

## Privacy and Control Model

This architecture aligns well with a privacy-first personal agent if a few
boundaries stay strict.

### What It Gets Right

- **Local-first control**: the canonical state lives on the user's machine
- **Portable state**: moving the agent means moving one database plus the
  runtime
- **Auditable history**: tool calls and file mutations can be inspected with
  normal database queries
- **Selective cloud use**: sync is optional, not the default source of truth
- **Sandboxed autonomy**: execution power does not imply host compromise

### Boundaries That Must Stay Explicit

- encrypted secrets should remain encrypted at rest inside the state store
- sync must be opt-in and scoped to user-controlled infrastructure
- capability grants to the sandbox must be explicit and minimal
- the sandbox should not become the memory system; durable state belongs in the
  persistence layer
- replication metadata and execution logs should remain inspectable by the user

## Portability Model

A portable personal agent should be recoverable from:

- one local state file
- one sandbox/runtime distribution
- one model configuration or provider binding

That portability should survive:

- restarts
- laptop-to-server moves
- offline periods
- branch- or repo-specific workspace transitions

This is stronger than ordinary chat history export. It treats the agent as a
stateful local program with durable memory and constrained execution, not as a
stateless API client.

## Relationship To Plaited Factories

This infrastructure sits below the factory layer.

Likely responsibilities:

- a memory factory manages working, episodic, and durable memory policy
- a bash or execution factory targets the sandbox surface instead of the host
  shell directly
- A2A and MCP factories expose controlled external coordination and tools
- snapshots remain the observable event stream feeding memory and audit records

The framework should not hard-code AgentFS or Boxer into `create-agent`.
Instead, factories and runtime adapters should project those infrastructure
choices into the agent through stable contracts.

## Near-Term Roadmap

1. Define the minimal durable schema for tasks, files, summaries, and tool
   traces.
2. Define the sandbox execution adapter contract for code, files, and
   capabilities.
3. Validate this infrastructure target through the bootstrap CLI and generated
   deployment scaffold.
4. Add a memory factory that can write durable records to the persistence
   layer.
5. Add an execution factory that targets the sandbox rather than assuming host
   shell execution.
6. Add optional replication and restore flows for multi-device continuity.

## Position

Yes, this is a credible direction for privacy-preserving, local-first personal
agents.

The strongest parts of the proposal are:

- local canonical state
- ephemeral sandboxed execution
- optional cloud sync rather than cloud dependence
- portability as a first-class infrastructure property

The main implementation challenge is not conceptual. It is preserving clear
boundaries so storage, execution, and reasoning stay replaceable instead of
collapsing into one tightly coupled runtime.
