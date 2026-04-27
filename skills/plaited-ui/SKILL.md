---
name: plaited-ui
description: Build and test Plaited's server-driven UI stack. Use when working on `src/ui`, controller islands, controller protocol schemas, SSR templates, CSS helpers, dynamic controller modules, or UI test fixtures.
license: ISC
compatibility: Requires bun and @playwright/cli for real browser controller tests
---

# Plaited UI

## Purpose

Use this skill when changing Plaited's UI runtime, renderer, CSS helpers, custom
element controllers, browser/server controller protocol, or UI tests.

The UI model is server-driven and island-scoped:

- the server or agent produces JSX templates
- `createSSR()` serializes templates into HTML strings
- `useController()` registers topic-scoped custom elements
- each island connects to `/ws` using its `p-topic` value as the WebSocket subprotocol
- the server pushes `render`, `attrs`, `import`, and `disconnect` commands
- the browser sends `ui_event` and `error` messages back to the server

Use `plaited-runtime` only when the task depends on behavioral-programming
semantics. The browser controller itself should stay small and protocol-shaped.

## Source Map

Public UI exports are re-exported from `src/ui.ts`.

| Area | Files | Primary APIs |
|---|---|---|
| Controller runtime | `src/ui/controller/use-controller.ts` | `useController` |
| Controller protocol | `src/ui/controller/controller.schemas.ts`, `src/ui/controller/controller.types.ts`, `src/bridge-events.ts` | `RenderMessageSchema`, `AttrsMessageSchema`, `ImportModuleSchema`, `ClientMessageSchema`, `ControllerModuleContext` |
| Controller utilities | `src/ui/controller/delegated-listener.ts`, `src/ui/controller/controller.constants.ts` | `DelegatedListener`, `delegates`, `SWAP_MODES` |
| Shadow DOM decoration | `src/ui/controller/decorate-elements.ts` | `decorateElements` |
| Rendering | `src/ui/render/template.ts`, `src/ui/render/ssr.ts`, `src/ui/render/template.types.ts`, `src/ui/render/template.constants.ts` | `createTemplate`, `h`, `Fragment`, `createSSR`, `P_TARGET`, `P_TRIGGER`, `P_TOPIC` |
| CSS | `src/ui/css/*.ts` | `createStyles`, `createTokens`, `createHostStyles`, `createRootStyles`, `createKeyframes`, `joinStyles` |
| Server bridge fixtures | `src/ui/controller/tests/fixtures/serve.ts` | test fixture server validating controller protocol surfaces and message flow |

## Controller Model

`useController()` is the browser runtime boundary. It creates a scoped custom
element registry and returns a function that registers controller element tags.

Controller islands require `p-topic`. The topic becomes the WebSocket
subprotocol and identifies the server-side conversation for that island.

Use these attributes:

- `p-topic`: placed on the controller island host; selects the WebSocket topic.
- `p-target`: placed on descendants that the server can update by `target`.
- `p-trigger`: placed on descendants that should emit BP-shaped browser events.

The controller only queries inside the island for `render` and `attrs` targets.
Do not make document-global target updates part of this runtime.

## Server To Browser Messages

Messages sent by the server are parsed as BP events first, then narrowed by
controller schemas.

Supported event types:

| Type | Detail | Behavior |
|---|---|---|
| `render` | `{ target, html, stylesheets, registry, swap? }` | Finds `[p-target="${target}"]` inside the island and applies HTML. Defaults to `innerHTML`. |
| `attrs` | `{ target, attr }` | Sets, removes, or toggles attributes on the target element. |
| `import` | site-root `.js` path | Dynamically imports a local controller module and invokes its default export. |
| `disconnect` | optional | Closes the island WebSocket. |

Swap modes are `afterbegin`, `afterend`, `beforebegin`, `beforeend`,
`innerHTML`, and `outerHTML`.

Rendered HTML is parsed through `template.setHTMLUnsafe()`. Dynamically inserted
`<script>` tags are inert in browsers; controller modules are the supported
runtime code-loading path.

Unknown server event types should report a controller `error` message rather
than silently bypassing the protocol.

## Browser To Server Messages

The browser sends top-level controller client messages:

| Type | Detail | Source |
|---|---|---|
| `ui_event` | BP event | `p-trigger` handlers and imported controller modules |
| `error` | string | controller parse/import/runtime failures |

`p-trigger` values serialize as space-separated `domEvent:eventType` pairs.
When a matching DOM event fires, the island sends:

```ts
{
  type: 'ui_event',
  detail: {
    type: eventType,
    detail: getAttributes(element),
  },
}
```

The detail is an attribute map from the triggering element, not DOM properties.
This gives the server/agent enough context while keeping the protocol
serializable.

After a controller module default export finishes, the island emits a BP event
inside `ui_event`:

```ts
{
  type: 'ui_event',
  detail: {
    type: 'import_invoked',
    detail: '/modules/example.js',
  },
}
```

## Controller Modules

Controller modules are loaded through `import` messages and run for side effects.
The import path must be site-root absolute and end in `.js`; query strings and
hash fragments are allowed for cache keys and identity changes.

Allowed examples:

- `/modules/search-panel.js`
- `/modules/search-panel.js?v=42`
- `/modules/search-panel.js#entry`
- `/modules/search-panel.js?v=42#entry`

Rejected examples:

- `modules/search-panel.js`
- `https://example.com/search-panel.js`
- `//example.com/search-panel.js`
- `/modules/search-panel.ts`
- `/modules/search-panel.js.map`

The module must export a default function:

```ts
import type { ControllerModuleContext } from 'plaited/ui'

export default ({ DelegatedListener, delegates, addDisconnect, trigger }: ControllerModuleContext) => {
  const button = document.getElementById('save')
  if (!button) return

  const listener = new DelegatedListener(() => {
    trigger({ type: 'save_clicked', detail: { id: button.id } })
  })

  delegates.set(button, listener)
  button.addEventListener('click', listener)
  addDisconnect(() => button.removeEventListener('click', listener))
}
```

The default export may be synchronous or async. The controller reports
`import_invoked` after the function resolves.

Imported modules should use `addDisconnect` for cleanup. They may reuse
`DelegatedListener` and `delegates` for listener lifecycle discipline. They
should emit BP-shaped events with `trigger`, not open their own controller
transport.

## Rendering Rules

JSX creates template objects, not DOM nodes.

Important rules:

- use `p-target` for server-addressable update points
- use `p-trigger` instead of inline event handlers
- `on*` attributes are rejected by the template renderer
- script tags are limited to site-root external JavaScript `src` values
- stylesheets are collected during template creation
- `createSSR()` deduplicates styles per renderer instance
- `decorateElements()` creates declarative Shadow DOM wrappers

Use `createSSR()` per connection or per rendering stream when style
deduplication matters. Call `clearStyles()` when a connection closes or when the
server must resend all styles.

## CSS Rules

Use the existing CSS helpers before adding styling infrastructure:

- `createStyles` for class-producing element styles
- `createHostStyles` for host styles used by Shadow DOM decorators
- `createRootStyles` for root-level declarations
- `createTokens` for design token references
- `createKeyframes` for animations
- `joinStyles` to combine style outputs

Do not hand-roll stylesheet concatenation unless the helper APIs cannot express
the case. Style deduplication depends on the existing stylesheet arrays.

## Testing Strategy

Choose the smallest test layer that proves the change.

| Layer | Use for | Command |
|---|---|---|
| Schema/pure tests | protocol validators, constants, helper behavior | `bun test src/ui/controller/tests/controller.schemas.spec.ts` |
| DOM/template tests | `decorateElements`, `DelegatedListener`, stable render output | `bun test src/ui/controller/tests/decorate-elements.spec.tsx src/ui/controller/tests/delegated-listener.spec.ts` |
| Real browser tests | WebSocket lifecycle, swaps, attrs, imports, dynamic DOM behavior | `bun test src/ui/controller/tests/controller-browser.spec.ts` |
| Typecheck | exported API and cross-module contracts | `bun --bun tsc --noEmit` |

Real browser tests use `@playwright/cli` plus
`src/ui/controller/tests/fixtures/serve.ts`. Prefer that fixture server over
mock WebSocket stacks for controller behavior.

Browser coverage should include:

- custom element registration
- WebSocket open and retry behavior
- all swap modes
- default `innerHTML` behavior when `swap` is omitted
- `attrs` string, number, boolean, and null removal behavior
- `p-trigger` to `ui_event` with attribute-map detail
- controller module import success
- `import_invoked`
- imported delegated listeners
- cleanup callbacks on disconnect
- invalid module and unsupported event error paths

Keep schema tests exhaustive for protocol edges:

- accepted and rejected swap modes
- required render fields
- primitive-only attrs
- site-root JavaScript import paths
- controller module default callable checks
- top-level client message discrimination

## Workflow

1. Read code before relying on docs. `src/ui/` and controller fixture/runtime files are
   the source of truth.
2. Start at the protocol boundary: schemas and event names first, DOM behavior
   second.
3. Keep controller changes island-scoped. Avoid document-level behavior unless a
   specific feature requires it.
4. Prefer `p-trigger` plus server/agent responses over client-local business
   logic.
5. Use controller modules for browser-side side effects that cannot be expressed
   as pushed HTML or attributes.
6. Add or update tests in the layer closest to the changed behavior.
7. Run targeted controller tests and `bun --bun tsc --noEmit` before committing.

## Common Pitfalls

- Do not accept remote import URLs for controller modules.
- Do not assume imported scripts in rendered HTML execute.
- Do not query outside the island when handling `render` or `attrs`.
- Do not attach duplicate listeners in imported modules; use `DelegatedListener`,
  `delegates`, and `addDisconnect`.
- Do not commit generated fixture `dist` files; fixture builds write under an
  ignored `dist` directory.

## Reference Files

Open these when you need deeper context, but verify them against code:

- `references/server-pipeline.md`: SSR/template pipeline details
- `references/css-system.md`: CSS helper details
- `references/controller-modules.md`: dynamic controller module import contract
- `references/testing.md`: UI test layering and browser fixture approach
- `references/websocket-decisions.md`: transport rationale

## Related Skills

- `plaited-runtime` for BP event semantics and server-side behavioral programs
- `code-documentation` for TSDoc and public API documentation
