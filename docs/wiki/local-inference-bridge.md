# Local Inference Bridge

> Status: target transport direction note.

## Problem

Plaited needs a same-machine bridge between runtime coordination and inference execution without turning model execution into an implicit network authority surface.

## Current vs Target

### Implemented now

- The repo contains runtime, worker, and MCP utility surfaces.
- This page does not claim a completed source-backed local inference bridge implementation in current `src/`.

### Target direction

- same-machine bridge uses a private local IPC lane
- envelope framing supports streaming, cancellation, diagnostics, and provenance
- policy and side-effect authority stay in Plaited runtime boundaries

## Boundary Rule

Inference transport is execution infrastructure, not policy authority. Trust assertions and execution authority remain governed by identity-plane and execution-plane policy flows described in the node-auth and boundary-contract doctrine pages.

## Related

- [Architecture](architecture.md)
- [Infrastructure](infrastructure.md)
- [Node-To-Node Auth](node-to-node-auth.md)
