# WebSocket Architecture Decisions

Open questions and recommendations for the generative UI WebSocket layer.

---

## 1. WebSocket Routing: Single `/ws` Endpoint vs Per-Island

**Context:** Currently `controller.ts:224` creates the WebSocket connection at `self.location.origin.replace(/^http/, 'ws')` — connecting to the root of the host. With Bun's `server.upgrade(req)`, the `fetch` handler can route by URL path and attach contextual `data` to each connection.

### Recommendations

**A. Single `/ws` route with session multiplexing**
One WebSocket endpoint at `/ws`. The server attaches a session ID + island identifier to `ws.data` during upgrade. All islands share the same connection and the server demultiplexes by island ID in each message envelope.

- Pro: One TCP connection per page, lower overhead
- Pro: Simpler server routing, single upgrade path
- Con: Requires message multiplexing logic; all islands share backpressure
- Con: `controlDocument` and `controlIsland` would need a shared connection manager

**B. Per-island route at `/ws/:island-id`**
Each `controlIsland` opens its own WebSocket to `/ws/<island-tag>`. The server upgrades at the matching route and scopes the connection to that island's behavioral program.

- Pro: Clean isolation — each island has its own connection, backpressure, and lifecycle
- Pro: Natural fit for island architecture (scoped area of effect)
- Pro: Server can reject unknown island tags at upgrade time
- Con: Multiple TCP connections per page (typically 1-3 islands, so manageable)

**C. Single `/ws` route with Bun pub/sub topics**
One WebSocket at `/ws`. Use Bun's native `ws.subscribe(islandId)` and `server.publish(islandId, message)` to scope messages to specific islands without manual routing.

- Pro: Zero custom multiplexing — Bun's pub/sub handles it natively at C++ speed
- Pro: Server can broadcast to all islands or target specific ones
- Pro: Single connection with island-level scoping
- Con: Pub/sub is fire-and-forget (no per-message acknowledgment)
- Con: All messages to an island go through the same socket (no per-island backpressure control)

---

## 2. SSR-to-WebSocket Handoff (Flicker Prevention)

**Context:** The initial page is server-rendered HTML. When the WebSocket connects, the agent may want to update content. If there's a gap between SSR and the first WebSocket render, the user could see stale content or layout shifts.

### Recommendations

**A. SSR is the truth; WebSocket only does incremental updates**
The initial HTML response from the server IS the current state. The WebSocket never re-renders the initial content — it only sends updates triggered by user actions or server-side events. No hydration step needed.

- Pro: Zero flicker by design — the SSR state and the "live" state are never out of sync
- Pro: Simplest mental model: SSR = snapshot, WebSocket = delta stream
- Pro: Matches our architecture perfectly (server renders with `createSSR`, then streams updates)
- Con: If server-side state changed between SSR and WebSocket connect, client won't know
- Mitigation: On `root_connected`, server can check if state drifted and send a targeted `render` update

**B. Embed a state version in SSR, reconcile on connect**
Include a `data-version` attribute on the root element during SSR. On `root_connected`, the server compares the client's version with current state. If they differ, send a targeted `render` message to update only the stale regions.

- Pro: Handles state drift without full re-render
- Pro: Fine-grained — only stale `p-target` regions update
- Con: Requires version tracking on the server
- Con: Brief moment where stale content is visible (but targeted update is fast)

**C. Skeleton-first SSR with WebSocket fill**
SSR sends a structural skeleton (layout, nav, chrome) without dynamic content. Dynamic regions are empty `p-target` divs. The WebSocket fills them immediately on connect.

- Pro: Never shows stale content — dynamic regions are empty until live
- Pro: Natural loading UX (skeleton screens are a well-understood pattern)
- Con: Slower perceived load — user sees empty regions briefly
- Con: Loses the SEO/FCP benefits of full SSR

---

## 3. Network Disconnect Detection

**Context:** When the network drops, the WebSocket's `close` event fires but the user may not be aware. Should we use a service worker tied to `controlDocument` to detect reconnection?

### Recommendations

**A. No service worker — use the existing controller retry loop**
The controller already has exponential backoff reconnection (`RETRY_STATUS_CODES`, `MAX_RETRIES`). Enhance it: on reconnect, send the session ID so the server can resume state. Add a visual connection indicator via `attrs` on a status element.

- Pro: No new moving parts — the controller already handles this
- Pro: Service workers can't hold WebSocket connections (spec limitation — [w3c/ServiceWorker#1072](https://github.com/w3c/ServiceWorker/issues/1072))
- Pro: Simpler debugging (one event loop, no worker lifecycle)
- Con: If the tab is backgrounded, the retry timer may be throttled by the browser
- Enhancement: Add `navigator.onLine` listener in `controlDocument` to trigger reconnect immediately when network returns instead of waiting for retry timer

**B. `navigator.onLine` + `online` event in `controlDocument`**
Add `online`/`offline` event listeners in `controlDocument`. On `offline`, pause retry attempts. On `online`, immediately trigger a `connect` event. No service worker needed.

- Pro: Instant reconnection when network returns (no waiting for retry timer)
- Pro: Saves unnecessary retry attempts while offline
- Pro: Two lines of code in `controlDocument`
- Con: `navigator.onLine` has false positives (reports online when behind a captive portal)
- Con: Doesn't help with tab backgrounding

**C. Service worker for offline fallback UI only**
Register a service worker that caches the initial SSR shell. When offline, serve the cached shell. The shell shows a "reconnecting" state. When online, the page reloads and reconnects naturally.

- Pro: User always sees something — even when offline
- Pro: Service worker handles the cache, not the WebSocket
- Con: More infrastructure (service worker registration, cache strategy, update lifecycle)
- Con: MPA view transitions may conflict with service worker navigation interception

---

## 4. MPA View Transitions + WebSocket Lifecycle

**Context:** `controlDocument` already listens for `pageswap` and `pagereveal` events and tears down on `pageswap`. In an MPA with view transitions, navigating between pages means the WebSocket closes and reopens. Should we persist session state?

### Recommendations

**A. Session ID in a cookie, reconnect on each page**
Set a session ID cookie during the initial HTTP response. On WebSocket upgrade, read it from `req.headers` (Bun gives you cookies in the upgrade). The server associates the session ID with the agent's state. Each page navigation = new WebSocket, same session.

- Pro: Zero client-side session management — cookies travel automatically
- Pro: Natural MPA lifecycle: each page is independent, session continuity is server-side
- Pro: `pageswap` cleanup works as-is; new page calls `controlDocument()` fresh
- Con: Brief reconnection gap during navigation (but view transition covers it visually)
- Implementation: Bun `server.upgrade(req, { data: { sessionId: cookie } })`

**B. Session ID in URL query param, no cookies**
Embed the session ID in the WebSocket URL: `/ws?session=abc123`. The server reads it during upgrade.

- Pro: Stateless server — no cookie parsing needed
- Pro: Explicit — the session is visible in the connection
- Con: Session ID leaks into browser history, referrer headers, server logs
- Con: Requires the SSR to embed the session ID into a `<meta>` tag or `data-` attribute for the client to read

**C. No session persistence — each page is a fresh context**
Every page navigation starts a clean behavioral program. The server treats each connection as independent. If the agent needs history, it queries its own state store.

- Pro: Simplest architecture — no session management at all
- Pro: Perfect isolation — no state leaks between pages
- Pro: Matches the "island" metaphor — each page load is a fresh island
- Con: Server-side agent must reconstruct context on each navigation
- Con: No way to "fast-forward" to where the user was

---

## 5. Server-Side State Fast-Forward

**Context:** If a user switches pages and reconnects, how should the server bring the UI to the current state without re-rendering the entire DOM?

### Recommendations

**A. Server renders the full page each time — no fast-forward needed**
Each page navigation triggers a fresh SSR. The server renders the current state of that page into HTML. No WebSocket state needs to be "replayed."

- Pro: Stateless on the client — the page always reflects current server state
- Pro: SEO-friendly — every page is a complete HTML document
- Pro: Natural for MPA — each URL is a complete view
- Con: If agent has in-flight work (e.g., streaming an LLM response), it's interrupted

**B. Server queues pending updates, replays on reconnect**
The server maintains a bounded queue of pending `render`/`attrs` messages per session. On reconnect, replay the queue. If the queue overflows, fall back to full SSR.

- Pro: Seamless resume for short disconnections
- Pro: Handles the "LLM is still streaming when user navigates back" case
- Con: Memory pressure — bounded queues per session
- Con: Complexity — queue management, ordering guarantees, TTL

**C. Server sends a state snapshot on `root_connected`**
On `root_connected`, the server checks if any state has changed since the last SSR. If so, it sends targeted `render` messages for only the stale regions (identified by `p-target`).

- Pro: Lightweight — only changed regions update
- Pro: No queue infrastructure needed
- Pro: Works naturally with recommendation 2B (version-based reconciliation)
- Con: Requires server to diff "last SSR state" vs "current state"

---

## 6. Injection Attack Prevention in WebSocket UI Streams

**Context:** The server sends executable HTML via `render` messages that the client inserts with `setHTMLUnsafe`. Is this an injection vector?

### Recommendations

**A. Trust the server pipeline; enforce at template creation (current approach)**
The server agent generates HTML through `createTemplate`, which:
- Escapes all text content by default (`htmlEscape`)
- Blocks `on*` event handlers (throws)
- Blocks `<script>` unless `trusted` flag is set
- Validates attribute types (only primitives)

The WebSocket channel is authenticated (origin validation + session). Only the server's template pipeline produces HTML. The client never composes HTML from user input.

- Pro: Defense-in-depth at the source — injection is prevented at template creation, not at consumption
- Pro: `setHTMLUnsafe` is safe when the HTML source is controlled (the server's own render pipeline)
- Pro: No client-side sanitization overhead
- Con: If a compromised server or MITM injects messages, the client will execute them
- Mitigation: Use WSS (TLS) and origin validation at upgrade

**B. Add CSP `connect-src` + Trusted Types**
Set Content-Security-Policy headers:
- `connect-src 'self'` — only allow WebSocket connections to same origin
- `require-trusted-types-for 'script'` — enforce Trusted Types for DOM sinks
- `script-src 'self'` — no inline scripts unless explicitly trusted

The `setHTMLUnsafe` call would need to go through a Trusted Types policy.

- Pro: Browser-enforced security boundary — even if server is compromised, CSP limits damage
- Pro: `connect-src 'self'` prevents cross-origin WebSocket connections (CSWSH mitigation)
- Pro: Industry best practice
- Con: Trusted Types + `setHTMLUnsafe` interaction needs testing
- Con: CSP can be complex to configure correctly for all edge cases

**C. Add origin validation at WebSocket upgrade + message signing**
Validate `Origin` header during Bun's `server.upgrade()`. Reject connections from untrusted origins. Optionally, sign messages with HMAC so the client can verify they came from the legitimate server.

- Pro: Directly addresses the OpenClaw-style CSWSH attack
- Pro: Origin validation is a one-line check in the `fetch` handler
- Pro: Message signing prevents MITM tampering (belt + suspenders with TLS)
- Con: HMAC signing adds latency per message
- Con: Key distribution for HMAC is non-trivial in browser context

---

## 7. Protocol Buffers vs JSON

**Context:** All controller messages are currently JSON. Protobuf offers ~50% size reduction and ~5x faster parsing. Is it worth the switch?

### Recommendations

**A. Stay with JSON (recommended)**
Generative UI messages are small (HTML fragments, attribute maps). The bottleneck is DOM insertion (`setHTMLUnsafe`, layout, paint), not JSON parsing. JSON is human-readable for debugging and natively supported by `WebSocket.send()` / `JSON.parse()`.

- Pro: Zero build tooling — no `.proto` files, no code generation, no schema sync
- Pro: Human-readable in browser DevTools Network tab
- Pro: `Zod` schemas already validate message structure at runtime
- Pro: The HTML payload inside `render.detail.html` is a string regardless of envelope format
- Con: Slightly larger wire size than Protobuf
- Analysis: For a typical `render` message, the JSON envelope is ~50 bytes. The HTML payload is 500-5000 bytes. Protobuf would save ~25 bytes on the envelope while the HTML string stays the same size. **The envelope overhead is negligible.**

**B. Use MessagePack as a middle ground**
MessagePack is binary JSON — same data model, smaller wire format, no schema required. Libraries are available for both Bun and browser.

- Pro: ~30% smaller than JSON with zero schema files
- Pro: Same data model — drop-in replacement for `JSON.stringify`/`JSON.parse`
- Pro: Faster than JSON parsing in benchmarks
- Con: Not human-readable in DevTools
- Con: Extra dependency on both client and server
- Con: Same analysis as above — the HTML payload dominates message size

**C. Protobuf for high-frequency messages only**
Keep JSON for `render` and `attrs` (large, infrequent). Use Protobuf for `user_action` and `snapshot` messages (small, frequent). Negotiate format during upgrade.

- Pro: Optimizes the hot path without disrupting the render pipeline
- Con: Two serialization formats = two code paths = double the complexity
- Con: `user_action` messages are already tiny JSON (`{ type: "user_action", detail: "click" }`)
- Con: Not worth the engineering cost for our message volumes

---

## 8. Token Exfiltration Prevention (OpenClaw CVE-2026-25253)

**Context:** The OpenClaw vulnerability (CSWSH) allowed a malicious page to connect to the victim's WebSocket, steal gateway tokens, and escalate to RCE. The attack worked because: (1) no origin validation on upgrade, (2) tokens passed via WebSocket payload, (3) sandbox could be disabled with stolen credentials.

### Recommendations

**A. Origin validation at upgrade + SameSite cookies (minimum viable)**
In the Bun `fetch` handler, check `req.headers.get('origin')` against an allowlist before calling `server.upgrade()`. Use `SameSite=Strict` cookies for session tokens.

```typescript
// In Bun.serve fetch handler
const origin = req.headers.get('origin')
if (!ALLOWED_ORIGINS.has(origin)) {
  return new Response('Forbidden', { status: 403 })
}
server.upgrade(req, { data: { sessionId } })
```

- Pro: Directly blocks the OpenClaw attack vector — cross-origin pages can't connect
- Pro: `SameSite=Strict` cookies won't be sent on cross-origin WebSocket upgrades
- Pro: Two lines of code
- Con: Origin header can be absent in some edge cases (e.g., privacy extensions)
- Con: Doesn't protect against same-origin XSS (but CSP does)

**B. Token-in-upgrade-header, never in payload**
Pass authentication tokens as HTTP headers during the upgrade request, never in WebSocket message payloads. Bun supports custom headers in `server.upgrade()` response. The server validates the token during upgrade and attaches the authenticated identity to `ws.data`.

- Pro: Tokens never traverse the WebSocket channel — can't be exfiltrated via message interception
- Pro: Authentication is a one-time check at connection, not per-message
- Pro: Bun's `ws.data` provides typed per-connection context
- Con: Browser `WebSocket` constructor doesn't support custom request headers (Bun extension only)
- Workaround: Use cookies (which are sent automatically) or a one-time token in the URL query string validated and discarded at upgrade

**C. CSP `connect-src` + no secrets in client code**
Set `Content-Security-Policy: connect-src 'self'` to prevent JavaScript from opening WebSocket connections to any origin other than the page's own. Additionally, never store API keys or tokens in client-side JavaScript — authentication should be cookie-based and HttpOnly.

- Pro: Browser-enforced — even if XSS occurs, the attacker can't connect to external WebSockets
- Pro: HttpOnly cookies are inaccessible to JavaScript (can't be exfiltrated via XSS)
- Pro: Aligns with Plaited's architecture — the client has no secrets, only the server does
- Con: CSP must be set correctly on every response (easy to miss on error pages)
- Con: Doesn't protect the server from accepting unauthorized connections (need origin validation too)

---

## Summary Matrix

| Question | Recommended | Rationale |
|----------|------------|-----------|
| 1. WS routing | **B** (per-island) or **C** (pub/sub) | Matches island architecture; Bun pub/sub is zero-cost |
| 2. Flicker prevention | **A** (SSR is truth) | Our architecture already does this — SSR renders current state |
| 3. Network detection | **B** (`online`/`offline` events) | Two lines of code, instant reconnect, no service worker |
| 4. MPA + session | **A** (cookie session ID) | Cookies travel automatically; natural MPA lifecycle |
| 5. State fast-forward | **A** (full SSR per page) or **C** (snapshot on connect) | MPA = each page is complete; snapshot handles edge cases |
| 6. Injection prevention | **A** + **B** (current + CSP) | Defense in depth: template escaping + CSP headers |
| 7. Protocol format | **A** (stay JSON) | Envelope overhead is negligible; HTML payload dominates |
| 8. Token security | **A** + **C** (origin + CSP + HttpOnly) | Directly blocks CSWSH; no secrets in client JS |

## Sources

- [Bun WebSocket API](https://bun.sh/docs/api/websockets)
- [View Transition API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
- [Cross-document view transitions (Chrome)](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
- [Window: pagereveal event (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagereveal_event)
- [CSWSH Exploitation in 2025](https://blog.includesecurity.com/2025/04/cross-site-websocket-hijacking-exploitation-in-2025/)
- [WebSocket Security (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Cross-site WebSocket hijacking (PortSwigger)](https://portswigger.net/web-security/websockets/cross-site-websocket-hijacking)
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [OpenClaw CVE-2026-25253](https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html)
- [Protobuf vs JSON Performance](https://www.gravitee.io/blog/protobuf-vs-json)
- [Service Worker WebSocket limitations (w3c)](https://github.com/w3c/ServiceWorker/issues/1072)
- [HTML Streaming for Web Performance (2025)](https://calendar.perfplanet.com/2025/revisiting-html-streaming-for-modern-web-performance/)
- [Protobuf vs JSON vs MessagePack benchmarks](https://hjkl11.hashnode.dev/performance-analysis-of-json-buffer-custom-binary-protocol-protobuf-and-messagepack-for-websockets)
