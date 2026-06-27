# Controller Architecture & Design Considerations

## Premise

Plaited `Controller.ts` is designed for **websites that are also agents**. Each page is server-rendered by an agent and imports a single `Controller` instance via an async script tag in `<head>`. The controller opens a persistent WebSocket to its agent and receives rendering instructions (HTML fragments + swap modes + stylesheets) over that channel. User interactions (`p-trigger`) send `ui_event` messages back to the agent, which decides what to render in response.

This is a **push-based rendering architecture** — the agent initiates DOM mutations without the client polling or requesting. It is architecturally distinct from pull-based hypermedia clients like htmx and server-enhancement frameworks like Stimulus.

---

## 1. Comparison With Contemporaries

### Stimulus JS

> Server renders HTML. Stimulus enhances it with behavior. No rendering on the client.

| Aspect | Stimulus | Plaited Controller |
|---|---|---|
| **Rendering** | Server renders all HTML; Stimulus never renders | Agent pushes HTML fragments over WebSocket |
| **Initiation** | User action → fetch → server → HTML | User action → `ui_event` → agent decides → `render` push |
| **State** | Lives in the DOM (`data-*` attributes) | Lives in the DOM, but agent is the authority |
| **Event wiring** | `data-action="event->controller#method"` | `p-trigger="domEvent:action"` |
| **Extensions** | Auto-discovered controllers from `data-controller` | Injected `Map<string, ControllerExtension>` |
| **Real-time** | Via Turbo / CableReady (add-on) | Native via persistent WebSocket |
| **Progressive Enhancement** | Yes — HTML works without JS | No — requires WebSocket (deliberate) |

### htmx

> Hypermedia-driven: return HTML fragments over HTTP and swap them into the DOM.

| Aspect | htmx | Plaited Controller |
|---|---|---|
| **Primary channel** | HTTP (AJAX) — pull | WebSocket — push |
| **Who initiates** | User action or timer | Agent decides, OR user action → agent decides |
| **Swap modes** | `hx-swap`: innerHTML, outerHTML, beforebegin, afterend (6 modes) | Identical 6 `SWAP_MODES` |
| **Targeting** | `hx-target="#id"` | `p-target="name"` |
| **Styling** | Server-rendered CSS | Dynamic `CSSStyleSheet` adoption from `render` messages |
| **Form handling** | Automatic via `hx-post` | Automatic via `#bindForms` + `form_submit` message |
| **Real-time** | Via SSE / WebSocket extensions (add-on) | Native — WebSocket is the primary channel |
| **Error handling** | HTTP error codes | `reportError()` → WebSocket error message |
| **Progressive Enhancement** | Yes — forms/links work without JS | No — WebSocket required |

### Key Difference

Both Stimulus and htmx assume the client is a **consumer of static or request-response HTML**. Plaited assumes the client is a **display surface for an autonomous agent** — the agent owns state and decides when the UI changes. This makes Plaited the wrong choice for a traditional content site, but the right foundation for an agent-powered web.

---

## 2. Architecture

### One Controller Per Page

```
Agent (server) ──WebSocket──▶ Controller (browser)
                                  │
                           ┌──────┴──────┐
                           │  p-target    │
                           │  p-trigger   │
                           │  extensions  │
                           └──────────────┘
                                  │
                           window.postMessage ──▶ Host app (web-A2A)
```

- The controller is instantiated once per page, via an async `<script type="module">` in `<head>`.
- Extensions are passed in the constructor as a `Map<string, ControllerExtension>`.
- The page lifecycle hooks (`onPageShow`, `onPageHide`, `onPageReveal`, `onPageSwap`) receive `ControllerExtensionParams` — the same context as extensions — so lifecycle handlers can `trigger`, `reportError`, and `addDisconnect`.
- A2A results are forwarded to the host app via `window.postMessage`.

### Render Flow

```
User clicks button with p-trigger="click:save"
    │
    ▼
Controller delegated listener fires
    │
    ├── Has extension for "click:save"? → call extension({ event, trigger, ... })
    │
    └── No extension → trigger({ type: "save", detail: {...} })
                           │
                           ▼
                    WebSocket send(ui_event)
                           │
                           ▼
                    Agent receives, decides
                           │
                           ▼
                    WebSocket push(render)
                           │
                           ▼
                    Controller #webSocketListener
                           │
                           ▼
                    #performSwap → setHTMLUnsafe → #bindTriggers → #bindForms
```

### Connection Lifecycle

```
connect()
    │
    ├── Register window listeners (pagehide, pagereveal, pageshow, pageswap)
    ├── Open WebSocket
    ├── #bindTriggers(body)
    └── #bindForms(body)

WebSocket open → #sendConnected() → agent receives controller_connected → agent reflects with success

WebSocket close (retryable code) → exponential backoff → reconnect

WebSocket close (non-retryable) → stop

pagehide → #pageHideListener → #sendControllerDisconnected() → #disconnect()
```

---

## 3. Risk Analysis & Mitigations

### Risk 1: No Progressive Enhancement

**Problem:** The controller requires a WebSocket. If JavaScript fails to load, or the WebSocket cannot connect, the page is non-functional.

**Context:** This is an MPA with dedicated routes per page. Each page is server-rendered by the agent. If JS is disabled entirely, the page is a static placeholder — this is acceptable for agent-based sites (the agent IS the application). But there is a gap: **JS is working, WebSocket connection fails, and all retries are exhausted.** In that state, the user sees a static page with no interactivity.

**Proposal: POST Fallback (Retry-on-Fail)**

When `#send()` detects the WebSocket is closed and retry count is exhausted (`>= UI_CORE_MAX_RETRIES`), serialize the pending `ClientMessage` as an HTTP POST body and send it via `fetch()` to the page's own route. The agent's HTTP handler parses the message identically to a WebSocket message and responds with an HTML fragment, which the controller swaps into the DOM via `#performSwap` as if it came from the WebSocket.

```
WebSocket closed + retries exhausted
    │
    ▼
#send switches to POST fallback
    │
    ▼
fetch(POST /page-route, body: ClientMessage)
    │
    ▼
Agent HTTP handler processes → returns HTML fragment
    │
    ▼
#performSwap (same path as WebSocket render)
```

**Requirements:**

- The agent must accept `ClientMessage`-shaped POST bodies at the page route.
- The controller needs a `fetchFallback(url)` method that mirrors `#send`'s serialization.
- The fallback should NOT attempt to reconnect the WebSocket until the next `connect()` call (e.g., on pageshow or explicit reconnection trigger).
- A `#isFallbackActive` flag prevents dual-sending while the fallback is engaged.

**Design Decisions:**

- The fallback does NOT attempt WebSocket reconnection on its own. If the POST receives a successful response, the controller attempts to re-establish the WebSocket. Otherwise, the user refreshes (full page load) or the browser/host app has its own reconnection mechanism.
- A `#isFallbackActive` flag prevents dual-sending while the fallback is engaged.
- The agent correlates the HTTP request with the user session via existing session mechanisms (cookies, tokens).

### Risk 2: No Replay for Missed Renders During Reconnection

**Problem:** If the WebSocket disconnects and reconnects, the controller has no way to recover renders that were pushed while the socket was down. The agent may have sent updates the user never saw.

**Proposal: Page State Snapshot on Lifecycle Events**

On `pagehide`, the controller sends a `page_state` message containing the full serialized DOM of the `<body>`:

```json
{
  "type": "page_state",
  "detail": {
    "html": "<body>...full serialized DOM...</body>",
    "stylesheets": ["...CSS text of each adopted stylesheet..."],
    "timestamp": 1712345678000
  }
}
```

On `pageshow` (or WebSocket reconnection), the controller sends the current `page_state` again. The agent can:

1. Compare the snapshot against its event log to determine what renders were missed.
2. Replay any missed `render` messages (or a consolidated diff).

**Implementation Notes:**

- Access DOM: `document.body.innerHTML` + `Array.from(document.adoptedStyleSheets).map(s => Array.from(s.cssRules).map(r => r.cssText).join(''))`.
- The snapshot should be sent **before** `#disconnect()` in the `pagehide` handler (to capture pre-teardown state) and **after** `connect()` in the `pageshow` handler (to capture current state).
- Keep snapshots small — the `innerHTML` string is transient and not persisted. It's purely a correlation aid for the agent.

**Design Decision:** Send as a separate `page_state` message type. This keeps `controller_connected` focused on connection lifecycle and lets the agent route `page_state` to its reconciliation logic independently.

### Risk 3: No Confirmation That the Agent Received a Message

**Problem:** `#send()` sends a message and forgets. There's no ACK from the agent, so the controller doesn't know if a `ui_event` or `form_submit` was received and processed.

**Proposal: Reflecting Response / Success Messages**

For each message the controller sends, the agent responds with a reflecting response that echoes the message type and indicates success:

```json
// Controller sends:
{ "type": "controller_connected", "detail": { "timestamp": 1712345678000 } }

// Agent responds:
{ "type": "controller_connected", "detail": { "status": "connected", "timestamp": 1712345678000 } }
```

This pattern is consistent across all message types (`ui_event`, `form_submit`, `page_state`). The agent reflects the original message type back with a success indicator. No per-message correlation IDs needed — the controller just needs to know the roundtrip works.

**Additional Message: `controller_disconnected`**

Add a new client → agent message type `controller_disconnected` that fires when `#disconnect()` is called (e.g., on `pagehide`):

```json
{ "type": "controller_disconnected", "detail": { "timestamp": 1712345678000 } }
```

This lets the agent know a page session has ended cleanly, vs a WebSocket close that may be transient (retry) or unexpected.

### Risk 4: AgentCard Doesn't Conform to A2A 1.0 Spec

**Problem:** The current `AgentCard` type is a minimal subset. The A2A 1.0 spec requires several fields the type doesn't declare.

**Current type:**

```ts
type AgentCard = {
  name: string
  description: string
  provider?: { organization: string }
  skills?: { id: string; name: string; description: string; tags?: string[]; examples?: string[] }[]
}
```

**A2A 1.0 required fields (from the spec's TypeScript interface):**

| Field | Current | Required? | Notes |
|---|---|---|---|
| `name` | ✅ | Required | |
| `description` | ✅ | Required | |
| `url` | ❌ | Replaced by `supportedInterfaces` | |
| `version` | ❌ | Required | Agent's own version string |
| `protocolVersion` | ❌ | Required | e.g. `"1.0"` |
| `capabilities` | ❌ | Required | Includes `streaming`, `pushNotifications`, etc. |
| `defaultInputModes` | ❌ | Required | e.g. `["application/json"]` |
| `defaultOutputModes` | ❌ | Required | e.g. `["text/html"]` |
| `skills` | Optional (missing `id` required) | Required array | Each skill needs `id`, `name`, `description` (minimum) |
| `provider` | Partial (only `organization`) | Optional per spec | Skip unless needed |
| `supportedInterfaces` | ❌ | Required in 1.0 | List of `{ url, protocolBinding, protocolVersion }` |

**Proposed update:**

```ts
type AgentCard = {
  name: string
  description: string
  version: string
  protocolVersion: string
  capabilities: {
    streaming: boolean
    pushNotifications: boolean
    extendedAgentCard?: boolean
  }
  defaultInputModes: string[]
  defaultOutputModes: string[]
  supportedInterfaces: {
    url: string
    protocolBinding: 'JSONRPC' | 'GRPC' | 'HTTP+JSON' | string
    protocolVersion?: string
    custom?: Record<string, unknown>
  }[]
  skills: {
    id: string
    name: string
    description: string
    tags?: string[]
    examples?: string[]
    inputModes?: string[]
    outputModes?: string[]
  }[]
  provider?: {
    organization: string
    url?: string
  }
  /**
   * Plaited extension: page-level Modnet tag metadata.
   *
   * This is NOT an A2A capability or skill. Capabilities are protocol-level
   * feature flags (streaming, pushNotifications, extendedAgentCard).
   * Skills describe domain operations the agent can perform.
   * Modnet tags describe what a specific PAGE/VIEW IS at runtime:
   * its content type, structure/scale, data boundary, and mechanics.
   *
   * Two pages served by the same agent can have different modnet tags
   * (e.g. kanban board vs chat widget). Tags can also differ per user
   * session (logged-in vs anonymous changes the boundary).
   *
   * @see https://rachelaliana.medium.com/modnet-design-standards-15e53176de41
   */
  modnet?: {
    /** Content type identifier (e.g. "board", "chat", "form"). Fixed vocabulary. */
    content: string
    /** Scale level from the Modnet hierarchy (S1–S8). Fixed range. */
    scale: string
    /** Data sharing boundary: all, none, or ask-permission. */
    boundary: 'all' | 'none' | 'ask'
    /** Interaction mechanics available on this page (key → value map). */
    mechanics?: Record<string, string>
  }
}
```

**Design Notes:**

- **`url`** on `supportedInterfaces[0]` = `self.location.href` (the page URL). The WebSocket endpoint is derived from this via protocol swap (`http` → `ws`).
- **`capabilities`** are A2A protocol-level feature flags. They declare what protocol mechanisms the agent supports (`streaming`, `pushNotifications`, `extendedAgentCard`), NOT what the page does.
- **`skills`** are A2A domain operations. Each skill has `id`, `name`, `description`, and optionally `tags`, `examples`, `inputModes`, `outputModes`. They declare what tasks the agent can perform.
- **`modnet`** is a Plaited-specific extension, not part of A2A. It describes the current page's structure and interactive semantics at runtime. It lives alongside `capabilities` and `skills`, not inside them.
- **`provider`** is optional per the A2A spec. Skip unless needed.

#### Why Capabilities and Skills Don’t Fit Modnet

A kanban board page has:

- **Mechanics:** card drag-to-reorder, column-swimlanes, tagging, assignee-filter
- **Boundary:** user sees only assigned cards (logged in) vs public view (anonymous)
- **Scale:** S5 (module — individual board), nested inside S6+ (workspace)

These describe the **runtime page**, not the agent’s protocol support (`capabilities`) or its domain operations (`skills`). The same agent might serve a kanban board on one route and a chat widget on another — different modnet tags for each. Permissions compound this: the `boundary` changes per session. Capabilities and skills are agent-level and static; modnet tags are page-level and dynamic.

Modnet lets agents negotiate at the page/content level. Agents with non-matching tags can still intermediate because tag keys and scale levels are fixed — the semantics are comparable even when values differ.

### Risk 5: A2A Result Assembly in the Controller

**Problem:** The `#a2aResultEmitter` method assembles JSON-RPC response envelopes (`jsonrpc`, `method`, `params`) in the controller. The code comment itself says _"NONE of this assembly should be happening here this should be happening server side."_

**Resolution:** The controller should be a **transparent bridge** for A2A results. The agent sends the complete JSON-RPC payload, and the controller simply calls:

```ts
window.postMessage(rawPayload, self.origin)
```

No envelope assembly in the controller. The `a2a_result` message from the agent should already contain the full JSON-RPC response structure (including `jsonrpc`, `id`, `result`/`error` fields). The controller just forwards it.

**Acceptance Criteria:**

- Remove `#a2aResultEmitter` method.
- In the `AGENT_TO_CONTROLLER_EVENTS.a2a_result` branch of `#webSocketListener`, extract the raw JSON-RPC string from the message and `postMessage` it directly.
- Update the `A2AResultMessage` schema to carry the pre-assembled JSON-RPC envelope.

---

## 4. Summary of Proposals

| Risk | Proposal | Priority | Effort |
|---|---|---|---|
| No progressive enhancement (WS down) | POST fallback — on retry exhaustion, serialize as HTTP POST. On success, attempt WebSocket reconnect. | Medium | Medium |
| Missed renders on reconnect | Page state snapshot (`document.body.innerHTML` + stylesheets) sent as `page_state` message on pagehide/pageshow | High | Small |
| No delivery confirmation | Reflecting response pattern — agent echoes message type with success indicator. New `controller_disconnected` message. | Medium | Small |
| AgentCard out of spec | Align to A2A 1.0: add `version`, `protocolVersion`, `capabilities`, `defaultInputModes`, `defaultOutputModes`, `supportedInterfaces`. Make skills `id` required. | High | Medium |
| AgentCard missing page metadata | Add `modnet` extension field (`content`, `scale`, `boundary`, `mechanics`). Not nested in capabilities or skills. | Medium | Small |
| A2A envelope assembly in controller | Remove `#a2aResultEmitter`. Agent sends pre-assembled JSON-RPC payload; controller just `postMessage`s it. | High | Small |
