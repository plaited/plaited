# UI Architecture

## Overview

`src/ui/` provides the rendering and protocol primitives for a generative web UI. An agent generates HTML on the server, streams it to the browser over WebSocket, and optionally injects client-side behavioral logic at runtime. All client-side coordination uses behavioral programming (BP) — the same engine that orchestrates the agent loop.

The full stack — agent + UI — is a Modnet node. Modules are generated for nodes, composed from the rendering and protocol primitives documented here.

## Directory Structure

```
src/ui/
  css/         Atomic CSS-in-JS: createStyles, createTokens, createHostStyles, createKeyframes, joinStyles
  dom/         Custom elements: controlIsland, controlDocument, decorateElements, DelegatedListener
  protocol/    Controller protocol: constants, Zod schemas, client-side behavioral controller
  render/      JSX factory (h/createTemplate), Fragment, SSR renderer (createSSR), template types
```

Public API is re-exported through `src/ui.ts`.

## Rendering Pipeline

### JSX Factory — `createTemplate` / `h`

`src/ui/render/template.ts`

The JSX factory converts JSX calls into `TemplateObject` — a data structure of HTML string arrays, collected stylesheets, and a custom element registry. Security is enforced at creation time:

- **`<script>` without `trusted={true}`** throws `UntrustedScriptError`
- **`on*` event handler attributes** throw `EventHandlerAttributeError` — all events use `p-trigger`
- **Non-primitive attribute values** throw `InvalidAttributeTypeError`
- All content is HTML-escaped by default; `trusted` opts out per element

Two special attributes coordinate server ↔ client:
- **`p-target`** — marks elements the server can address for later `render` or `attrs` messages
- **`p-trigger`** — binds DOM events to BP events: `p-trigger={{ click: 'submit' }}` serializes to `p-trigger="click:submit"`

`Fragment` groups children without a wrapper element.

### SSR Renderer — `createSSR`

`src/ui/render/ssr.ts`

Stateful per-connection renderer with style deduplication:

```typescript
const { render, clearStyles } = createSSR()

// First render: emits <style>...</style> + HTML
const html = render(template)

// Same styles again: HTML only (styles already sent on this connection)
const html2 = render(anotherTemplate)

// Connection closed: reset the dedup tracker
clearStyles()
```

- Deduplication via a `Set<string>` — each stylesheet string is sent at most once per connection
- `:host{}` → `:root{}` rewriting for light DOM compatibility
- Style injection before `</head>` or after `<body>` tag

### CSS System

`src/ui/css/`

- **`createStyles`** — atomic CSS from style objects. Each property generates a hashed class name for deduplication and reuse. Supports nested media queries, pseudo-classes, and attribute selectors.
- **`createTokens`** — design token system using CSS custom properties. Token names are kebab-cased into `--ident-prop` vars. Each token is a function returning `var(--...)` with a `stylesheets` property containing the `:root{}` declarations.
- **`createHostStyles`** — host-element-scoped styles for Shadow DOM
- **`createKeyframes`** — `@keyframes` generation
- **`joinStyles`** — combines host styles with stylesheet arrays

## Custom Elements

### `controlIsland` — Interactive Island

`src/ui/dom/control-island.ts`

Creates a custom element with its own `behavioral()` instance. Each island is an independent BP engine with WebSocket controller, scoped DOM update surface, and lifecycle event forwarding.

```typescript
const Shell = controlIsland({ tag: 'app-shell', observedAttributes: ['theme'] })
```

On `connectedCallback`:
1. Property accessors are defined for each observed attribute (boolean attrs use `toggleAttribute`, others use `getAttribute`/`setAttribute`)
2. `controller()` is initialized with the element as root — this opens a WebSocket immediately
3. `on_connected` BP event fires

Eight lifecycle callbacks are forwarded as typed BP events (`ELEMENT_CALLBACKS`): `on_adopted`, `on_attribute_changed`, `on_connected`, `on_disconnected`, `on_form_associated`, `on_form_disabled`, `on_form_reset`, `on_form_state_restore`.

The element uses `display: contents` so it doesn't create a layout box. A `restrictedTrigger` blocks `RESTRICTED_EVENTS` + `ELEMENT_CALLBACKS` from external callers — dynamically loaded modules cannot fire lifecycle or internal events.

Renders with brand `🎛️` (`CONTROLLER_TEMPLATE_IDENTIFIER`).

### `decorateElements` — Shadow DOM Decorator

`src/ui/dom/decorate-elements.ts`

Moves nodes out of the main DOM to reduce node count, captures styles and layouts, and leverages slots via declarative Shadow DOM. Wraps content in `<template shadowrootmode>` for SSR-compatible shadow roots.

```typescript
const Card = decorateElements({
  tag: 'ui-card',
  shadowDom: (
    <>
      <div {...styles.wrapper}>
        <slot name="header" />
        <slot />
      </div>
    </>
  ),
  hostStyles: cardHostStyles,
})
```

- `:root{}` → `:host{}` rewriting (inverse of SSR's `:host{}` → `:root{}`)
- Defaults: `mode: 'open'`, `delegatesFocus: true`, `cloneable: true`
- Renders with brand `🎨` (`DECORATOR_TEMPLATE_IDENTIFIER`)

### `controlDocument` — Document-Level Controller

`src/ui/dom/control-document.ts`

Document-scoped behavioral controller for MPA view transitions. Creates a BP engine on `document`, wires up the WebSocket controller, and listens for `pageswap`/`pagereveal` events on `window`.

- `pageswap` always tears down the disconnect set (cleanup on navigation)
- Optional `onPageReveal` factory receives `restrictedTrigger` and returns the handler
- `DOCUMENT_EVENTS`: `on_pagereveal`, `on_pageswap`

### `DelegatedListener`

`src/ui/dom/delegated-listener.ts`

Minimal `EventListener` implementation with a `WeakMap`-based delegate registry. Elements and WebSockets are stored as weak keys — when the target is GC'd, the listener reference is automatically cleaned up.

## Controller Protocol

`src/ui/protocol/`

### Event Constants

`CONTROLLER_EVENTS` (14 events):

| Direction | Events |
|-----------|--------|
| Server → Client | `render`, `attrs`, `update_behavioral`, `disconnect` |
| Client → Server | `client_connected`, `user_action`, `snapshot` |
| WebSocket lifecycle | `connect`, `retry`, `on_ws_open`, `on_ws_message`, `on_ws_error` |

### Message Envelope

Client → Server messages use `{ id: string, msg: ... }` envelope format:
- `client_connected` — `{ id, msg: tagName }` (e.g., `'app-shell'` or `'document'`)
- `user_action` — `{ id, msg: actionType }` (the `p-trigger` action string)
- `snapshot` — `{ id, msg: SnapshotMessage }` (BP engine observation)

Server → Client messages are bare `BPEvent` objects parsed with `BPEventSchema`.

### Message Schemas (Zod)

All schemas in `controller.schemas.ts`:

| Schema | Direction | Detail |
|--------|-----------|--------|
| `RenderMessageSchema` | S→C | `{ target, html, swap? }` |
| `AttrsMessageSchema` | S→C | `{ target, attr: Record<string, string\|number\|boolean\|null> }` |
| `UpdateBehavioralMessageSchema` | S→C | `z.httpUrl()` — URL to import |
| `DisconnectMessageSchema` | S→C | `undefined` |
| `ClientConnectedMessageSchema` | C→S | `{ id, msg }` envelope |
| `UserActionMessageSchema` | C→S | `{ id, msg }` envelope |
| `SnapshotEventSchema` | C→S | `{ id, msg: SnapshotMessage }` |

### Restricted Trigger

`RESTRICTED_EVENTS` blocks client→server events + WebSocket lifecycle events from the `restrictedTrigger`. This means:
- Server messages parsed from WebSocket dispatch through `restrictedTrigger` — they can fire `render`, `attrs`, `update_behavioral`, `disconnect`
- Dynamically loaded modules and external callers cannot fire `client_connected`, `user_action`, `snapshot`, `connect`, `retry`, or WebSocket lifecycle events

### Controller Lifecycle

`src/ui/protocol/controller.ts`

1. **Immediate connect** — `controller()` calls `trigger({ type: 'connect' })` synchronously at the end of initialization
2. **WebSocket created** — `connect` handler opens `ws://` to `self.location.origin`
3. **Handshake** — `on_ws_open` sends `client_connected` with `{ id, msg: tagName }`
4. **Message dispatch** — `on_ws_message` parses incoming JSON with `BPEventSchema` and forwards through `restrictedTrigger`
5. **Render** — `render` handler finds `[p-target="..."]`, creates `DocumentFragment` via `template.setHTMLUnsafe(html)`, binds `p-trigger` listeners, then calls `performSwap`
6. **User action** — `p-trigger` listener fires `user_action` into BP engine locally (if a bThread listens for that action type), then sends to server via `{ id, msg }` envelope
7. **Dynamic code** — `update_behavioral` imports URL, validates with `UpdateBehavioralModuleSchema`, calls `factory(restrictedTrigger)`, merges returned `{ threads?, handlers? }` into BP engine
8. **Reconnection** — exponential backoff on close codes 1006/1012/1013, max 3 retries
9. **Teardown** — `disconnect` message closes WebSocket; `disconnectedCallback` calls all disconnect functions

### Swap Modes

Six DOM insertion modes for `render` messages: `innerHTML` (default), `outerHTML`, `afterbegin`, `beforeend`, `beforebegin`, `afterend`.

### Script Execution

Inline `<script>` tags in `render` messages do NOT execute. The HTML spec marks scripts inserted via fragment parsing APIs (`setHTMLUnsafe`, `innerHTML`) as parser-inserted and suppresses execution. The only path for dynamic client-side code after initial page load is `update_behavioral` + `import(url)`.

## Modnet Integration

The Modnet vocabulary maps directly to these UI primitives:

| Modnet Concept | UI Primitive |
|----------------|-------------|
| **Module** (front+back-end unit) | `controlIsland` — each island is an independent behavioral program with its own WebSocket |
| **Content Type** (MSS tag) | Template content generated by the agent via `createTemplate`/`h` |
| **Structure** (MSS tag) | `decorateElements` for DOM organization + slots; `p-target` addressing for server updates |
| **Mechanics** (MSS tag) | `update_behavioral` — agent generates and loads behavioral code at runtime |
| **Boundary** (MSS tag) | `restrictedTrigger` enforces what dynamically loaded code can do |
| **Scale** (MSS tag) | `createTokens` design token system; `controlDocument` for document-level coordination |

Modules are generated by the agent for nodes. The agent produces both the HTML structure (via SSR) and the behavioral logic (via `update_behavioral`), composing them into Modnet modules that are delivered to the client over WebSocket.
