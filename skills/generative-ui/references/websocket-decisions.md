# WebSocket Architecture Decisions

## Overview

Eight architectural decisions were evaluated and resolved during the design of the generative UI WebSocket layer. All are implemented. This reference captures the rationale as a historical record.

## Decisions

### 1. WebSocket Routing — Single `/ws` + Bun Pub/Sub

**Decided:** Option C. One WebSocket endpoint at `/ws`. Bun's native `ws.subscribe(islandId)` and `server.publish(islandId, message)` scope messages to specific islands without custom multiplexing. Zero routing overhead at C++ speed.

**Why not per-island routes:** Single connection is simpler. Bun pub/sub provides island-level scoping without multiple TCP connections per page.

**Implementation:** `src/server/server.ts`

### 2. SSR-to-WebSocket Handoff — SSR Is Truth

**Decided:** Option A. The initial SSR HTML response IS the current state. The WebSocket only sends incremental updates triggered by user actions or server-side events. No hydration step.

**Why:** Zero flicker by design — SSR state and live state are never out of sync. Simplest mental model: SSR = snapshot, WebSocket = delta stream. Matches the existing `createSSR` → stream updates architecture.

### 3. Network Disconnect Detection — Controller Retry Loop

**Decided:** Option A (existing retry loop), enhanced with `navigator.onLine` from Option B. The controller already has exponential backoff reconnection (`RETRY_STATUS_CODES`, `MAX_RETRIES`). No service worker — service workers cannot hold WebSocket connections (w3c/ServiceWorker#1072).

**Enhancement possible:** Add `navigator.onLine` listener in `controlDocument` for instant reconnect when network returns.

**Implementation:** `src/ui/protocol/controller.ts` (retry logic)

### 4. MPA View Transitions + Session — Cookie Session ID

**Decided:** Option A. Session ID set as a cookie during initial HTTP response. On WebSocket upgrade, Bun reads it from `req.headers`. Each page navigation opens a new WebSocket with the same session. `pageswap` cleanup works as-is.

**Why not URL query params:** Session ID would leak into browser history and referrer headers.

**Implementation:** `src/server/server.ts` (`sid` cookie, read during `server.upgrade()`)

### 5. Server-Side State Fast-Forward — Full SSR + Replay Buffer

**Decided:** Options A + B combined. Each page navigation triggers fresh SSR (the page always reflects current server state). A bounded replay buffer queues pending `render`/`attrs` messages per session for short disconnections (e.g., LLM still streaming when user navigates back).

**Implementation:** `src/server/server.ts` (replay buffer with TTL)

### 6. Injection Prevention — Template Escaping + CSP

**Decided:** Options A + B. Defense in depth:
- **Template layer:** `createTemplate` escapes text content, blocks `on*` handlers, blocks `<script>` without `trusted`, validates attribute types
- **Transport layer:** CSP headers (`connect-src 'self'`, `script-src` policy), origin validation at upgrade

**Why this is safe:** The WebSocket channel is authenticated. Only the server's template pipeline produces HTML. The client never composes HTML from user input.

**Implementation:** `src/ui/render/template.ts` (escaping), `src/server/server.ts` (CSP headers)

### 7. Protocol Format — JSON

**Decided:** Option A. Stay with JSON. The HTML payload inside `render.detail.html` dominates message size (500-5000 bytes). The JSON envelope is ~50 bytes — Protobuf would save ~25 bytes on the envelope while the HTML string stays the same. Zod schemas validate structure at runtime. Human-readable in DevTools.

### 8. Token Security — Origin Validation + CSP + HttpOnly

**Decided:** Options A + C. Directly blocks CSWSH (OpenClaw CVE-2026-25253):
- **Origin validation** at `server.upgrade()` rejects cross-origin WebSocket connections
- **`SameSite=Strict` cookies** prevent cross-origin cookie transmission
- **CSP `connect-src 'self'`** browser-enforced — even XSS can't connect to external WebSockets
- **HttpOnly cookies** inaccessible to JavaScript — no token exfiltration via XSS
- **No secrets in client code** — authentication is cookie-based, server-side only

**Implementation:** `src/server/server.ts` (origin check, CSP headers, cookie flags)

## Sources

- [Bun WebSocket API](https://bun.sh/docs/api/websockets)
- [CSWSH Exploitation (OpenClaw CVE-2026-25253)](https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html)
- [WebSocket Security (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)
- [Service Worker WebSocket limitations (w3c)](https://github.com/w3c/ServiceWorker/issues/1072)
- [Content Security Policy (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
