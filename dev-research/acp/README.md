# ACP History References

This directory contains historical ACP code copied out of Git history for
reference while designing a new Bun-driven ACP adapter. These files are not
active package source and should not be treated as current runtime contracts.

## Provenance

| Directory | Source commit | Purpose |
| --- | --- | --- |
| `standalone-client/` | `6f08716b85b104b8a8d67eb11066bba7d716f929` (`Feat/acp client (#216)`) | Headless ACP client and Bun stdio JSON-RPC transport. |
| `agent-adapter/` | `02858820` (`feat(agent): add ACP adapter for editor-based debug viewport`) | Agent-side ACP adapter that bridged editor sessions into `AgentNode` events. |
| `factory-lane/` | `c893779e` (`feat(factories): build base factory lanes`) | Later ACP factory lane shape for sessions, advertised capabilities, and runtime state. |

## What To Read First

Start with `standalone-client/src/acp/acp-transport.ts` for the subprocess
transport. It shows the old newline-delimited JSON-RPC framing, request ID
tracking, timeout handling, notification routing, request routing, and graceful
shutdown behavior around Bun subprocess stdio.

Then read `standalone-client/src/acp/acp-client.ts`. It layers ACP lifecycle
operations over the transport: initialize, create session, stream prompt updates,
cancel prompt, handle permissions, and disconnect.

Read `agent-adapter/src/agent/acp-adapter.ts` for the opposite direction: an ACP
agent implementation that exposes Plaited as an editor-facing agent. It maps ACP
session methods into Plaited node events and maps node output back into ACP
session updates.

Use `factory-lane/src/factories/acp-factory/` as a newer runtime-shape reference.
It is not a protocol adapter, but it shows how ACP-like session state was later
expressed as factory state and events.

## Relevant Design Notes

- The standalone client is closest to a Bun ACP client adapter.
- The agent adapter is closest to an ACP server/agent-side adapter.
- The factory lane is closest to current Plaited control-plane modeling.
- The copied code references old runtime types and old event names; porting it
  directly will require adapting to the current `src/agent`, `src/worker`, and
  runtime/client contract.
- Treat the JSON-RPC transport boundary as the most reusable part. Treat
  permission handling, event names, and session state as design input rather
  than current truth.

## Useful Git Commands

```bash
git show 6f08716b:src/acp/acp-transport.ts
git show 6f08716b:src/acp/acp-client.ts
git show 02858820:src/agent/acp-adapter.ts
git show c893779e:src/factories/acp-factory/acp-factory.ts
```
