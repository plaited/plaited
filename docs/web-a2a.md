# Web-A2A: Browser-Embedded Adaptation of A2A

## Motivation

Standard A2A is a server-to-server protocol. An agent publishes an Agent Card at a well-known URL, and clients discover it via HTTP, fetch the card, then send JSON-RPC requests to the agent's endpoint.

Web-A2A adapts this for a topology where the agent bridge lives inside a browser page embedded in a native application:

```
┌──────────────────┐     postMessage     ┌──────────────────┐     WebSocket     ┌──────────────┐
│  Native App      │◄──────────────────►│  Controller JS   │◄─────────────────►│  Remote Agent │
│ (local agent)    │                    │  (browser page)  │                    │   (server)    │
└──────────────────┘                    └──────────────────┘                    └──────────────┘
```

The native app (iOS with WKWebView, Android with WebView, Flutter with webview_flutter, etc.) communicates with the Controller via `window.postMessage`, not HTTP. The Controller relays tasks to the remote agent over a WebSocket and relays responses back.

The Agent Card is not fetched from a URL — the native app requests it via `agent/getCard` postMessage, and the Controller responds with the card. The card's `name` and `description` can be derived from the page's `<title>` and `<meta>` tags, making the card discoverable from the page itself.

## Relationship to A2A

Web-A2A does not define new protocol methods. It aligns with existing A2A concepts but strips fields that are meaningless when the agent bridge lives in a browser page.

| A2A Method | Web-A2A Equivalent | Notes |
|---|---|---|
| `SendMessage` | `task/send` (via postMessage) | Same semantics, different transport |
| `GetTask` | `task/update` (via postMessage) | Server pushes result, app receives it |
| `GetExtendedAgentCard` | `agent/getCard` | Same purpose: client requests the Agent Card |

### agent/getCard

Request/response pattern following JSON-RPC 2.0:

```jsonc
// Native App → Controller
{ "jsonrpc": "2.0", "method": "agent/getCard", "id": "req-1" }

// Controller → Native App
{ "jsonrpc": "2.0", "id": "req-1", "result": { /* AgentCard */ } }
```

This replaces A2A's `GET /.well-known/agent-card.json` and `GetExtendedAgentCard`. Since the card is typically provided to the Controller at construction time or derived from the page DOM, the response is synchronous — no fetch, no auth handshake.

## AgentCard

Standard A2A defines an Agent Card with fields that assume an HTTP-reachable server. Web-A2A keeps only the fields that make sense for a browser-embedded agent bridge.

| Field | A2A | Web-A2A | Why |
|---|---|---|---|
| `name` | required | required | Agent identity. Can be derived from `<title>` or a `<meta name="agent-name">` tag. |
| `description` | required | required | What the agent does. Can be derived from `<meta name="description">` or a `<meta name="agent-description">` tag. |
| `url` | required | **removed** | The agent bridge is not reachable at a URL — the native app talks via postMessage. |
| `version` | required | required | Compatibility. Can be derived from `<meta name="agent-version">`. |
| `provider.organization` | optional | optional | Who built it. |
| `skills` | optional | optional | What tasks the agent can perform. |
| `documentationUrl` | optional | **removed** | User is on the page — documentation is in the UI. |
| `iconUrl` | optional | **removed** | The native app doesn't hot-link web icons for in-app display. |
| `supportedInterfaces` | recommended | **removed** | The interface is fixed: postMessage → Controller → WebSocket. |
| `capabilities` | optional | **removed** | Streaming and notifications are handled by the page UI, not negotiated between app and bridge. |
| `securitySchemes` | optional | **removed** | Same-origin postMessage channel — no authentication to negotiate. |
| `defaultInputModes` | optional | **removed** | The page is the UI — it already knows what formats it accepts. |
| `defaultOutputModes` | optional | **removed** | Same — rendering is the page's concern. |
| `signatures` | optional | **removed** | Same-origin postMessage doesn't benefit from JWS-signed cards. |

### Card shape

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

The `name`, `description`, and `version` fields can be provided explicitly to the Controller or derived from the page DOM by reading standard HTML metadata elements.

## Transport

| Layer | Standard A2A | Web-A2A |
|---|---|---|
| Request | HTTP POST to agent URL | `window.postMessage` to Controller |
| Response | HTTP response body | `window.postMessage` from Controller |
| Streaming | SSE / WebSocket (server→client) | WebSocket (Controller→server) + render messages (server→page UI) |
| Discovery | `GET /.well-known/agent-card.json` | `agent/getCard` postMessage to Controller |
| Auth | OAuth2, API key, mTLS | Same-origin — no auth needed |

## Why not just use standard A2A?

Standard A2A assumes the client can reach the agent via HTTP(S). In this architecture, the native app cannot reach the remote agent directly — it only controls the browser viewport. The Controller acts as a same-origin bridge. If the remote agent were reachable from the native app, standard A2A would be the right choice.