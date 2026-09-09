# UI Layer — Controller and html tools

Reference for an agent assisting an engineer in wiring up the UI layer of a
behavioral app. There are two surfaces, both driven by a
[behavioral program](./behavioral.md)'s `selection` listeners (the action
channel):

- **Browser `Controller`** — applies `render`/`attrs` (plus
  `dispatch_custom_event`/`navigate`/`scale_check`) to a **live DOM** over a
  WebSocket.
- **Stateless html tools** — apply `render`/`attrs` to an **HTML string** in
  memory, in a Bun process (SSR).

There is **no `Renderer` class** — SSR is stateless html-in / html-out tools.
The two surfaces share the same `render`/`attrs` vocabulary; the substrate
(live DOM vs string) is the variable.

## Browser Controller

`Controller` is exported via the `@behavioral/sh/controller` package export
(re-exported from `src/controller/controller.ts`). Construct one instance per
page, loaded as an async module script in `<head>`:

```ts
import { Controller } from '@behavioral/sh/controller'
```

The constructor takes lifecycle hooks and optional extensions:

```ts
new Controller({
  extensions,            // optional Map<string, ControllerExtension>
  onPageReveal,          // page reveal callback
  onPageSwap,            // page swap callback
  onPageHide,            // pagehide callback
  onPageShow,            // pageshow callback
})
```

### The push model

This is the load-bearing concept: a behavioral page is **push-based**, not
pull-based. The controller does not fetch state and render client-side; it
opens a WebSocket to its serving agent and applies server-pushed messages:

| Server → browser (`CONTROLLER_INCOMING_MESSAGE_TYPES`) | What the Controller does |
|----------------------------------------------------------|---------------------------|
| `render` | Apply HTML to `[b-target]` elements per the `swap` mode |
| `attrs` | Set/remove attributes on `[b-target]` elements |
| `dispatch_custom_event` | Fire a `CustomEvent` on the target |
| `navigate` | Navigate the page (URL change) |
| `scale_check` | Resolve the effective `b-scale` for a target and reply with `scale_check_result` |

User interactions and page lifecycle emit messages back to the agent:

| Browser → agent (`CONTROLLER_OUTGOING_MESSAGE_TYPES`) | When |
|---------------------------------------------------------|------|
| `ui_event` | A `b-trigger` declaration fired (DOM event → BP event with `getAttributes` detail) |
| `snapshot` | A page lifecycle event (`pagereveal`/`pageswap`/`pagehide`/`pageshow`) — serialized HTML via `getHTML({ serializableShadowRoots: true })` |
| `success` | A server message was applied successfully (carries the request `id`) |
| `error` | A message handler threw (carries `name`, `error`, `stack`, `id`) |
| `scale_check_result` | Reply to a `scale_check` message (carries `effectiveScale`) |
| `form_submit` | A `b-form` form POST completed |

The agent — running a behavioral program — is the source of truth for what
the page shows; the Controller is the DOM applier.

## Stateless html tools (SSR)

The five html `useTool` units live in-repo at `src/tools/html.ts`. Their
input/output schemas are re-exported via the `@behavioral/sh/tools` package
export; the tool **instances** are in-repo only:

```ts
// Schemas (public package export)
import {
  HtmlRenderInputSchema, HtmlRenderOutputSchema,
  HtmlUpdateAttributesInputSchema, HtmlUpdateAttributesOutputSchema,
  HtmlScaleCheckInputSchema, HtmlScaleCheckOutputSchema,
  HtmlValidateAndEscapeInputSchema, HtmlValidateAndEscapeOutputSchema,
  HtmlValidateAttributeValueInputSchema, HtmlValidateAttributeValueOutputSchema,
} from '@behavioral/sh/tools'

// Tool instances (in-repo source)
import {
  htmlRender, htmlUpdateAttributes, htmlScaleCheck,
  htmlValidateAndEscape, htmlValidateAttributeValue,
} from '../../tools/html.ts'
```

| Tool name | Purpose |
|-----------|---------|
| `html-render` | Insert or replace content at every `[b-target]` match per `swap` mode |
| `html-update-attributes` | Merge an attribute map into every `[b-target]` match |
| `html-scale-check` | Read-only: resolve the effective structural scale a render would nest inside |
| `html-validate-and-escape` | Validate + escape a full HTML string (attributes + CSS in `<style>`) in one pass |
| `html-validate-attribute-value` | Validate one `{ tag, attr, val }` against the per-tag schema (substrate-neutral) |

The tools are **stateless**: `html` is both the input document and the
output's resulting document — thread each output `html` back in as the next
call's `html` input. The document is the state.

### `html-render` / `html-update-attributes`

```ts
const out = htmlRender({
  html,      // the full HTML document (input)
  target,    // the b-target value to match
  fragment,  // markup payload to insert/swap (validated before the pass)
  swap,      // 'afterbegin' | 'afterend' | 'beforebegin' | 'beforeend' | 'innerHTML' | 'outerHTML'
  id,        // request id, threaded to the output
  match,     // '=' | '^=' | '~=' | '*=' — selector match operator (default '=')
})
// out: { id, target, html } on success — html is the NEW document
//      { id, target, html: <original input>, isError, message, htmlViolations?, cssViolations? } on failure
```

The `fragment` payload is validated via `html-validate-and-escape` **before**
the rewriter pass — an invalid payload returns an error with the original
input `html` unchanged, even when no `[b-target]` element matches (security:
never silently accept a dangerous payload). `html-update-attributes` validates
each value inside the rewriter callback (the tag is only known there); on any
failure the partially-mutated transform is discarded and the original `html`
is returned unchanged. Zero matches is a no-op.

### `html-scale-check`

```ts
const out = htmlScaleCheck({
  html, target, swap, id, match,
})
// out: { id, target, effectiveScale } — 's1'..'s6' | 'rel'
```

Pre-flight read: resolves the structural scale context a `render` into or
beside this `target` would nest inside. **Into modes** (`afterbegin`,
`beforeend`, `innerHTML`) read the target's own `b-scale`; **replace/beside
modes** (`beforebegin`, `afterend`, `outerHTML`) read the nearest ancestor's.
Across multiple matches, returns the **most restrictive** (lowest-rank)
effective scale. Zero matches or no `b-scale` found anywhere → `rel`. The
browser counterpart is the `scale_check` incoming message (the Controller
replies with `scale_check_result`).

### The contract: validation-failure-as-data, zero-match no-op

1. **Payloads are validated before selector match.** `html-render` and
   `html-update-attributes` validate the fragment/attribute payload *before*
   matching `[b-target]`. A schema-invalid or XSS-laden payload returns
   `{ isError: true, ... }` with the original document unchanged **even when
   no element matches** — the tools never silently accept a dangerous payload.
   Failures are data, not throws.
2. **Zero matches is a no-op, not an error.** For a string transform via
   `HTMLRewriter`, zero matches means the element handler doesn't fire and the
   document is left unchanged. The browser `Controller` **does** throw
   `ElementNotFoundError` when a DOM node is `null` mid-iteration — that's a
   live-DOM concern, absent on the SSR string side.

## When to use which

- **Wiring a multi-page app**: one `Controller` per page, constructed in the
  page's `<head>` async module. The WebSocket URL is derived from the page's
  origin (`location.href.replace(/^http/, 'ws')`).
- **Binding interactive elements**: declare `b-trigger` and `b-form`
  attributes in the DOM; the Controller wires them to emit `ui_event`
  messages on user interaction. No manual `addEventListener` in your code.
- **Page lifecycle**: the `onPage*` hooks fire on `pagereveal`/`pageswap`/
  `pagehide`/`pageshow`. The browser owns document-bound teardown (listeners,
  sockets, timers) on unload and bfcache freeze; the Controller does **not**
  force-close the socket on `pagehide` so a queued snapshot can flush during
  teardown.
- **SSR / pre-render**: a behavioral-program `selection` listener calls
  `html-render` / `html-update-attributes` directly to produce an HTML string
  for an initial page load or snapshot. Thread the output `html` back in as
  the next call's input — the document is the state.
- **Scale pre-flight**: the agent sends `scale_check` (browser) or calls
  `html-scale-check` (SSR) to learn the effective `b-scale` a render target
  lives in before generating content.

## A common wiring mistake to avoid

Calling `Controller` methods directly to mutate the DOM. The Controller is a
**message applier**, not a DOM API — `render`/`attrs`/`dispatch_custom_event`/
`navigate` arrive as server-pushed messages and are dispatched internally,
not called by your code. If you find yourself reaching for a Controller method
to change the page, the correct path is to emit a `ui_event` (via a
`b-trigger`/`b-form` declaration) and let the agent's behavioral program
respond with a server-pushed `render`. The DOM is downstream of the agent,
not the other way around.

The second common mistake: expecting the WebSocket to be manually managed.
The Controller handles connect, retry (with bounded backoff on codes 1006/
1012/1013, max 3 retries), and message queuing during disconnect internally.
Do not wrap it in your own reconnection logic — that duplicates the built-in
behavior and races with the Controller's own retry.

The SSR-side mistake: discarding the output `html`. The tools are stateless —
each call takes the current document as `html` input and returns the new
document as `html` output. If you feed the stale original into the next call,
every prior mutation is lost.

## See also

- [behavioral](./behavioral.md) — the runtime whose `selection` listeners
  drive both surfaces (the action channel).
