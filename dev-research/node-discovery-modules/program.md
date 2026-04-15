# Node Discovery Modules

## Goal

Research the default module bundle for node discovery identity and
publication.

This lane should define how the system:

- represents a stable public node identity
- maps that identity to a reachable discovery surface
- coordinates discovery publication across host changes
- separates host-owned resolution mechanics from module-owned policy

The point is not to hard-code ENS, DID, or one discovery provider into the
core. The point is to make node discovery a well-scoped module family that
composes with A2A, node-home persistence, bootstrap, and transport.

## Why This Lane Exists

The current direction now separates:

- boxed runtime execution
- durable node-home persistence
- host-owned launch and attachment behavior

What remains open is the discovery-identity layer:

- what stable public identifier a node should use
- how ENS, DID, or similar identities map to A2A Agent Card discovery
- when the host republishes or rebinds discovery metadata
- when modules should trigger those discovery updates

Without this lane, discovery policy risks being split awkwardly between raw
host plumbing and A2A transport code without an explicit owner.

## Relationship To Other Lanes

This lane sits under:

- [dev-research/server-module/program.md](../server-module/program.md)

It should integrate with:

- [dev-research/a2a-modules/program.md](../a2a-modules/program.md)
- [dev-research/node-auth-modules/program.md](../node-auth-modules/program.md)
- [dev-research/node-home-modules/program.md](../node-home-modules/program.md)
- [dev-research/agent-bootstrap/program.md](../agent-bootstrap/program.md)
- [dev-research/notification-modules/program.md](../notification-modules/program.md)

The intended split is:

- `node-discovery-modules` owns discovery identity and publication policy
- `a2a-modules` owns A2A transport and Agent Card protocol behavior
- `node-home-modules` owns persistence and promotion semantics
- the host owns concrete resolution and publication hooks

## Dependency Order

1. [docs/INFRASTRUCTURE.md](../../docs/INFRASTRUCTURE.md) defines the host / box / node-home split
2. [src/modules/a2a-module/](../../src/modules/a2a-module) defines the current Agent Card and A2A seams
3. GitHub issue-backed module backlog planning owns cross-lane bundle
   decisions
4. adjacent lanes provide A2A, auth, node-home, and bootstrap constraints
5. this lane hill-climbs the discovery identity slice and feeds winners back
   into GitHub issue-backed module backlog planning

## Core Hypothesis

The best discovery story will separate:

- stable identity
  - ENS, DID, or another portable public identifier
- reachable discovery target
  - Agent Card URL, gateway URL, or equivalent published endpoint
- publication policy
  - when records change and who triggers the update

That split keeps identity portable while allowing execution to move between
hosts.

## Product Target

The first shipped discovery module bundle should support:

1. a stable public node identifier
2. mapping that identifier to a current discovery target
3. explicit policy for when discovery metadata is published or updated
4. coordination with promotion and handoff behavior
5. separation between public Agent Card data and authenticated/private details

## Required Architectural Properties

### 1. Host And Module Responsibilities Must Stay Distinct

The host should own:

- actual ENS/DID resolution or publication calls
- concrete networking and reachability checks
- platform-integrated credentials and secure publication hooks

Modules should own:

- when publication should happen
- what discovery metadata should be published
- when promotion or handoff requires rebinding
- how discovery state is represented in runtime policy

### 2. Stable Identity Must Survive Host Changes

Moving from phone to server should not require a new public identity.

This lane should prefer designs where:

- identity remains stable
- reachable target may change
- publication updates are explicit and observable

### 3. A2A Must Remain The Node-Facing Discovery Contract

This lane should treat ENS or DID as an identity and resolution layer, not a
replacement for A2A-facing discovery metadata.

### 4. Public And Private Discovery Data Must Stay Separate

This lane should preserve a distinction between:

- public discovery metadata
- authenticated or private extension data

## Research Questions

This lane should answer:

- should ENS, DID, or another identifier be the primary stable node identity?
- what exactly should a public identity resolve to?
- how should host-managed publication and module-managed policy communicate?
- when should promotion from phone to server trigger a discovery update?
- should gateways be first-class in the initial design?

## Deliverables

This lane should produce:

- a concrete discovery-identity contract
- candidate discovery publication module bundles
- evaluation tasks for resolution, republish, and handoff scenarios
- a recommendation for the default discovery-identity bundle
