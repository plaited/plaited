# Plaited Agent Infrastructure

> Status: wiki architecture direction for local-first, cloud-synced Plaited
> agents. This page describes an infrastructure target, not a claim that the
> full stack is already implemented in `src/`.

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

An optional adjacent concern is:

- **Identity / trust layer**: stable node identity, trust claims, and
  verification services that may be local, self-hosted, or provider-managed

Plaited stays deployment-agnostic at the framework layer. This document
describes one concrete infrastructure shape that fits the current agent and
module direction.

This document is intended to be validated by the bootstrap CLI surface:

- `plaited bootstrap`

## Stack

### Cognitive Layer

The cognitive layer is the Plaited agent itself:

- `src/agent/create-agent.ts` provides the minimal execution core
- modules add memory, tools, transport, and policy
- snapshots retain observable execution state
- the model remains replaceable

The important deployment split is between the local control plane and the
attached inference plane. A node can keep orchestration, memory, policy, and
durable state local while routing primary inference to a stronger workstation
or server lane when a larger model is the better fit.

The intended policy is consistent contracts across tiers. Local operation can
use smaller or quantized variants, while attached server hardware can run
larger variants for stronger reasoning or multimodal workloads. The routing
decision should change model size and hosting lane, not the agent's contract or
overall behavior model.

This layer decides what to do. It does not need direct host-level access to do
it.

### Persistence Layer: Node Home

The persistence layer is the node's durable home: a portable workspace-shaped
state bundle that survives app restarts, device changes, and execution-host
migration.

It should hold:

- workspace files and generated artifacts
- real Git state for any persisted repos or worktrees
- long-term key-value state such as preferences and retained summaries
- tool-call and execution traces for auditability and recovery
- task and queue state for resumable execution
- sync, migration, and replication metadata

The important property is not the exact storage engine name. The important
property is that node state is:

- local
- structured
- portable
- incrementally mutable
- queryable

One concrete shape is:

- a real directory tree for files and repos
- a normal `.git/` directory for versioned workspace state
- a local metadata database such as SQLite/libSQL alongside that tree

AgentFS may still be a good abstraction or implementation strategy for this
layer, but it should be treated as a candidate abstraction rather than the
answer by assumption. The system requirement is a portable node home, not a
specific storage brand.

### Identity / Trust Layer

The identity / trust layer is an optional adjacent service boundary that
supports:

- stable node identity independent of the current A2A URL
- peer trust and trust-state transitions
- signed trust or capability claims
- verification of peer-presented identity metadata

One credible direction is:

- A2A remains the node-facing communication protocol
- a stable cryptographic identity, DID, or equivalent identifies the node
- signed claims such as VC-like credentials or equivalent signed metadata carry
  trust, authority, or extension information
- a local, self-hosted, or provider-managed SSI/trust service may issue,
  verify, or manage those credentials

The important property is not one mandatory standards stack. The important
property is that identity remains:

- stable across URL changes
- portable across hosts
- separable from the current discovery locator
- reviewable in trust decisions

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

## Layering Model

The cleanest deployment model is:

- Docker/Boxer image = the executable runtime package
- node home = the persisted user state
- host device or server = the thing that launches the package and attaches the
  node home
- optional trust service = the thing that provisions or verifies node identity
  and trust claims when that deployment profile requires it

That means the boxed runtime may contain:

- `createAgent()`
- the server-module transport lane and UI/controller protocol runtime
- bounded execution tools and generated code

But the durable node home should remain outside the disposable runtime image
and be projected into it by the host.

The key rule is:

- the node may run inside the box
- the node home must not be trapped inside the box

## Host / Box / Home Split

### Host

The host device or server should own:

- launching and stopping the boxed runtime
- attaching or mounting the node home
- transport reachability and host-specific networking
- discovery-identity attachment and publication hooks
- identity/trust service attachment and provider configuration when used
- promotion, export, import, and handoff orchestration
- any host-native keychain or secure-storage integration

### Boxed Runtime

The boxed runtime should own:

- running `createAgent()`
- running the server-module lane plus UI protocol surfaces
- reading and writing the projected node home
- executing bounded tools and generated code
- calling the attached trust service or local trust module when it needs peer
  identity verification, claim verification, or trust-policy inputs

### Node Home

The node home should own durable state such as:

- generated files and workspace artifacts
- real Git state
- metadata and recall indexes
- config, sync state, and recovery state
- portable identity metadata, peer trust cache, and migration state needed to
  preserve identity continuity across host or provider changes

## Discovery Identity

Discovery identity should be treated as adjacent to infrastructure, but not
collapsed into the boxed runtime itself.

One credible direction is:

- A2A Agent Card discovery provides the node-facing discovery contract
- the current Agent Card URL is the mutable locator, not the stable identity
- a stable cryptographic identity, DID, or equivalent may provide the stable
  node identity layer
- signed trust or capability claims may be carried through VC-like credentials
  or equivalent signed metadata
- A2A extensions provide negotiated capability contracts such as MSS support
- the host provides the concrete publication, reachability, and trust-service
  attachment hooks
- modules decide when discovery metadata should be updated or republished and
  how trust claims influence exposure

The intended split is:

- the host resolves or publishes the current reachable discovery target
- the boxed runtime serves the node-facing discovery and interaction surfaces
  and uses trust inputs from the attached trust layer
- modules coordinate policy around:
  - which A2A extensions are declared in the Agent Card
  - which negotiated extensions are active for a given request
  - when a public discovery record should change
  - when promotion or handoff should trigger republishing
  - how public Agent Card data differs from authenticated/private details

This keeps discovery identity stable even when the active execution host moves
between phone, local machine, and server.

It also allows ordinary rebinding behavior:

- the node may change its current URL or subdomain
- the stable node identity does not need to change
- known peers can update the stored locator for that identity through existing
  authenticated communication or, in the worst case, manual reintroduction

For modnet specifically, one credible direction is to treat MSS support as an
A2A extension contract rather than as an implicit out-of-band assumption.
Under that model:

- Agent Cards declare MSS extension support
- clients negotiate MSS activation through normal A2A extension mechanisms
- extension-specific MSS semantics ride on top of the base A2A contract

## Attachment Model

The preferred attachment model is:

1. the host opens or prepares the node-home substrate
2. the host mounts or projects that node home into the boxed runtime
3. the boxed runtime runs the agent against that mounted home
4. the boxed runtime can be restarted or moved without changing the logical
   node home

If AgentFS is used, the cleanest fit is:

- AgentFS lives as the durable node-home substrate
- the host mounts or exposes the AgentFS-backed filesystem into the box
- the runtime inside the box reads and writes that mounted view

This is simpler and safer than treating the box image itself as the durable
storage boundary.

## Deployment Sketches

### Phone-Hosted Node

- OnBraid launches the Boxer runtime locally
- the phone stores the user's node home in app-managed durable storage
- the host attaches that node home to the boxed runtime
- the agent and server run inside the box against the mounted home
- the phone may use a local trust module or an attached external trust service
  when the chosen deployment profile needs one

### Server-Hosted Node

- a server launches the same Boxer runtime
- the server stores the user's node home on durable server storage
- the host attaches that node home to the boxed runtime
- the agent and server run inside the box against the mounted home
- the server may also run or attach a self-hosted trust service such as an
  SSI/DID/VC service

### Provider-Managed Trust Service

- a provider may host or provision an external trust service for DID, VC, or
  equivalent trust operations
- the node still uses A2A as the peer communication protocol
- the host attaches provider configuration and credentials to the runtime
- the node home should retain enough portable identity metadata and peer state
  to avoid hard lock-in to one provider
- provider-managed trust services are optional deployment profiles, not a
  mandatory requirement of the framework

### Phone-To-Server Promotion

- the phone exports or syncs the node home
- the server imports or attaches that same logical node home
- the server launches the Boxer runtime against it
- execution moves, but identity and durable state continuity remain tied to the
  node home

## Execution Loop

The intended execution loop is:

1. The user or scheduler triggers a task.
2. The host/orchestrator loads the relevant state from the node home.
3. The host/orchestrator mounts or exposes that state to the boxed runtime as
   the node's working filesystem.
4. The boxed runtime runs the Plaited agent over recent context, retained
   memory, and current task state.
5. Generated code or tools run inside the boxed runtime against the mounted
   node-home view.
6. Mutations remain durable in the node home.
7. The boxed runtime may exit or be restarted.
8. Replication or promotion pushes the updated state to other trusted devices
   when enabled.

The key split is:

- execution is ephemeral
- memory is durable

## Privacy and Control Model

This architecture aligns well with a privacy-first personal agent if a few
boundaries stay strict.

### What It Gets Right

- **Local-first control**: the canonical state lives on the user's machine
- **Portable state**: moving the agent means moving one portable node-home
  bundle plus the runtime
- **Auditable history**: tool calls and file mutations can be inspected with
  normal database queries
- **Selective cloud use**: sync is optional, not the default source of truth
- **Sandboxed autonomy**: execution power does not imply host compromise

### Boundaries That Must Stay Explicit

- encrypted secrets should remain encrypted at rest inside the node home
- sync must be opt-in and scoped to user-controlled infrastructure
- capability grants to the sandbox must be explicit and minimal
- the sandbox should not become the memory system; durable state belongs in the
  persistence layer
- the boxed runtime image should not be treated as the durable storage boundary
- replication metadata and execution logs should remain inspectable by the user

## Portability Model

A portable personal agent should be recoverable from:

- one portable node-home bundle
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

## Relationship To Plaited Modules

This infrastructure sits below the module layer.

Likely responsibilities:

- a memory module manages working, episodic, and durable memory policy
- a node-home or workspace-persistence module manages durable file, Git,
  checkpoint, export, and recovery policy
- a bash or execution module targets the sandbox surface instead of the host
  shell directly
- A2A and MCP modules expose controlled external coordination and tools
- snapshots remain the observable event stream feeding memory and audit records

The storage backend and the persistence policy should remain separate concerns.

- backend adapters decide how the node home is stored or mounted
  - native filesystem
  - AgentFS
  - another portable workspace substrate
- the node-home or workspace-persistence module decides when durable state
  changes are materialized and how they are managed over time
  - write and edit policy
  - Git checkpoint and commit policy
  - bundle or export policy
  - promotion and handoff policy
  - restore and recovery policy

The framework should not hard-code AgentFS, Boxer, or any specific persistence
backend into `create-agent`.
Instead, modules and runtime adapters should project those infrastructure
choices into the agent through stable contracts.

## Near-Term Roadmap

1. Define the minimal node-home contract for files, Git state, summaries,
   tasks, and tool traces.
2. Define the sandbox execution adapter contract for code, files, and
   capabilities.
3. Validate this infrastructure target through the bootstrap CLI and generated
   deployment scaffold.
4. Add a memory module that can write durable records to the persistence
   layer.
5. Add a node-home or workspace-persistence module that governs file writes,
   Git persistence, checkpoints, exports, and recovery behavior.
6. Add an execution module that targets the sandbox rather than assuming host
   shell execution.
7. Add optional replication, promotion, and restore flows for multi-device and
   phone-to-server continuity.

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
