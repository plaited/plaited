# Web-A2A: A2A for Browser-Embedded Local Agent Bridges

## Motivation

Standard A2A is a server-to-server protocol. An agent publishes an Agent Card at a well-known URL, and clients discover it via HTTP, fetch the card, then send JSON-RPC requests to the agent's endpoint.

Web-A2A adapts this for a different topology:

```
┌─────────────┐     postMessage     ┌──────────────────┐     WebSocket     ┌──────────────┐
│  Flutter App │◄──────────────────►│  Controller JS   │◄─────────────────►│  Remote Agent │
│ (local agent)│                    │  (page runtime)  │                    │   (server)    │
└─────────────┘                     └──────────────────┘                    └──────────────┘
```

Here the "client" (Flutter) and the "agent bridge" (Controller) live in the same process — the Flutter app embeds a WebView that runs the Controller. Communication happens via `window.postMessage`, not HTTP. The Controller relays tasks to the remote agent over a WebSocket and relays responses back.

The Agent Card is not fetched from a URL — it is provided to the Controller at construction time and returned to Flutter on demand via `agent/getCard`.

## Relationship to A2A

Web-A2A does not define new protocol methods. It aligns with existing A2A concepts but strips fields that are meaningless in a browser-embedded context.

| A2A Method | Web-A2A Equivalent | Notes |
|---|---|---|
| `SendMessage` | `task/send` (via postMessage) | Same semantics, different transport |
| `GetTask` | `task/update` (via postMessage) | Server pushes result, Flutter receives it |
| `GetExtendedAgentCard` | `agent/getCard` | Same purpose: client requests the Agent Card |

### agent/getCard

Request/response pattern following JSON-RPC 2.0:

```jsonc
// Flutter → Controller
{ "jsonrpc": "2.0", "method": "agent/getCard", "id": "req-1" }

// Controller → Flutter
{ "jsonrpc": "2.0", "id": "req-1", "result": { /* AgentCard */ } }
```

This replaces A2A's `GET /.well-known/agent-card.json` and `GetExtendedAgentCard`. Since the card is passed to the Controller at construction time, the response is synchronous — no fetch, no auth handshake.

## AgentCard

Comparison of A2A required fields vs Web-A2A:

| Field | A2A | Web-A2A | Why |
|---|---|---|---|
| `name` | required | required | Identity |
| `description` | required | required | What the agent does |
| `url` | required | **removed** | The agent is not reachable at a URL — Flutter talks via postMessage |
| `version` | required | required | Compatibility |
| `provider.organization` | optional | optional | Who built it |
| `skills` | optional | optional | What tasks the agent can perform |
| `documentationUrl` | optional | **removed** | User is on the page — docs are in the UI |
| `iconUrl` | optional | **removed** | Flutter doesn't hot-link web icons for in-app display |
| `supportedInterfaces` | recommended | **removed** | The interface is fixed: postMessage → Controller → WebSocket |
| `capabilities` | optional | **removed** | Streaming/notifications are handled by the page UI, not negotiated |
| `securitySchemes` | optional | **removed** | Same-origin postMessage channel — no auth to negotiate |
| `defaultInputModes` | optional | **removed** | The page is the UI — it already knows what it accepts |
| `defaultOutputModes` | optional | **removed** | Same — rendering is the page's concern |
| `signatures` | optional | **removed** | Same-origin postMessage doesn't need JWS-signed cards |

### Final type

```ts
type AgentCard = {
  name: string
  description: string
  version: string
  provider?: { organization: string }
  skills?: {
    id: string
    name: string
    description: string
    tags?: string[]
    examples?: string[]
  }[]
}
```

## Transport

| Layer | Standard A2A | Web-A2A |
|---|---|---|
| Request | HTTP POST to agent URL | `window.postMessage` to Controller |
| Response | HTTP response body | `window.postMessage` from Controller |
| Streaming | SSE / WebSocket (server→client) | WebSocket (Controller→server) + render messages (server→page UI) |
| Discovery | `GET /.well-known/agent-card.json` | `agent/getCard` postMessage to Controller |
| Auth | OAuth2, API key, mTLS | Same-origin — no auth needed |

## Why not just use standard A2A?

Standard A2A assumes the client can reach the agent via HTTP(S). In this architecture, Flutter cannot reach the remote agent directly — it only controls the WebView. The Controller acts as a same-origin bridge. If the remote agent were reachable from Flutter, standard A2A would be the right choice.
