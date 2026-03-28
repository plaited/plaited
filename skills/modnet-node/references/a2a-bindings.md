# A2A Protocol Bindings

Implementation details for A2A transport configuration across deployment contexts.
The high-level node rationale lives in [`../SKILL.md`](../SKILL.md). Protocol
implementation is in `src/a2a/`.

## Transport Strategy

The A2A spec (v1.0.0) requires encrypted communication but is transport-agnostic. The spec supports custom protocol bindings, including WebSocket (`protocolBinding: "WEBSOCKET"`). The requirement is **encryption**, not specifically HTTPS — `wss://` satisfies it for WebSocket, and unix sockets need no encryption (traffic never leaves the kernel).

**Bun-native implementation** — no a2a-js dependency. `Bun.serve()` handles all A2A transport needs in a single server: HTTP (JSON-RPC/REST), WebSocket (custom binding for persistent connections), and unix sockets — all with native mTLS support.

```typescript
Bun.serve({
  unix: "/tmp/a2a.sock",          // same-box: k8s pods, docker-compose
  tls: { cert, key, ca },         // cross-network: mTLS
  fetch(req, server) {
    // A2A JSON-RPC/REST endpoints (Layer 3 binding)
    // WebSocket upgrade for persistent A2A + UI
    // Agent Card at /.well-known/agent-card.json
  },
  websocket: {
    // A2A streaming (bidirectional, custom binding)
    // UI controller protocol (generative UI)
  },
})
```

A2A Layers 1 (data model) + 2 (abstract operations) are implemented once. Layer 3 (protocol binding) varies by deployment context and interaction pattern.

## Wire Selection by Deployment

| Deployment | Wire | Security | Bun API |
|---|---|---|---|
| **Same box** (k8s pod, docker-compose) | Unix domain socket | OS-level (no network) | `Bun.serve({ unix })` + `fetch({ unix })` |
| **Same cluster** (k8s services, docker network) | TCP over internal DNS | mTLS via cert-manager/Istio or direct | `Bun.serve({ tls })` + `fetch()` |
| **Cross-network** (sovereign nodes) | TCP over internet | mTLS (`MutualTlsSecurityScheme`) | `Bun.serve({ tls })` + `fetch()` / `new WebSocket()` |

## Protocol Selection by Interaction Pattern

| Pattern | Protocol | When |
|---|---|---|
| **One-shot** (query, lookup, single task) | HTTP+JSON POST | Default. Stateless, no connection overhead. |
| **Streaming response** (task progress) | HTTP POST → SSE response (`text/event-stream`) | Standard A2A streaming. NOT `EventSource` (POST-initiated). `fetch()` + `ReadableStream`. |
| **Active collaboration** (multi-turn negotiation) | WebSocket | Persistent bidirectional. Avoids repeated TLS handshake per message. |
| **Async updates** (post-disconnect) | Webhook (HTTP POST back) | A2A native push notifications. |

Transport is **per-interaction, not per-node.** A node can use HTTP for one task and WebSocket for another with the same peer. The Agent Card declares both via `supportedInterfaces`; the client selects based on interaction needs. WebSocket is an optimization for sustained collaboration, not a requirement. HTTP+JSON is the default.

## A2A Interaction Strategy

The five A2A operations compose into a hybrid interaction model:

| A2A Operation | Wire | When |
|---|---|---|
| `POST /message:send` | HTTP POST → JSON response | One-shot. Short task, immediate result. |
| `POST /message:stream` | HTTP POST → SSE response | Client wants real-time progress. Connection held until task completes. |
| `POST /tasks/{id}:subscribe` | HTTP POST → SSE response | Client reconnects to in-progress task. Resumes from where it left off. |
| Push notification (webhook) | Agent POSTs to client's registered URL | Client disconnects, gets notified async. Requires client to be a server. |
| WebSocket (custom binding) | Persistent `wss://` connection | Active multi-turn collaboration. Replaces repeated POST + SSE cycles. |

**Typical interaction flow:**

```
1. POST /message:send → taskId + ack           (fire-and-forget)
2. Want real-time? POST /message:stream         (SSE, hold open)
3. Connection drops? POST /tasks/{id}:subscribe (SSE, resume)
4. Don't need real-time? Register webhook       (async POST back)
5. Heavy collaboration? Upgrade to WebSocket    (persistent bidirectional)
```

Each operation is independent — the client picks the right one per interaction. No state machine needed. Every node is already a server (`Bun.serve()`), so receiving webhooks is free.

**K8s same-box optimization:** Pods in the same deployment share a unix socket via `emptyDir` volume mount. Pods in different deployments use k8s Service DNS with mTLS. Same `Bun.serve()`, different wire.

## Bun Networking Surface

All networking primitives available for A2A and internal communication:

| Bun API | Protocol | TLS | Unix Socket | Use For |
|---|---|---|---|---|
| `Bun.serve()` | HTTP + WebSocket server | Yes | Yes | A2A server, UI server, WebSocket upgrade |
| `fetch()` | HTTP client | Yes | Yes | A2A client calls, inference server |
| `Bun.listen()` | Raw TCP server | Yes | Yes | Custom binary protocol (future) |
| `Bun.connect()` | Raw TCP client | Yes | Yes | Custom binary protocol (future) |
| `Bun.udpSocket()` | UDP | No | No | Heartbeats, discovery (future) |
| `Bun.spawn({ ipc })` | IPC (structured clone) | N/A | N/A | PM ↔ sub-agent |
| `new WebSocket()` | WebSocket client | Yes (`wss://`) | No | A2A client to other nodes |
