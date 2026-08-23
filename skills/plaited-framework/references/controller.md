# Controller

Reference for an agent assisting an engineer in wiring up the browser side
of a Plaited multi-page app. The `Controller` is the browser-side counterpart
to the server-side [`Renderer`](./renderer.md): where the Renderer applies
`render`/`attrs` to an HTML string in memory, the Controller applies the same
commands — plus `dispatch_custom_event` and `navigate` — to a live DOM, over a
WebSocket to the serving agent. The pair together is the UI layer driven by a
[behavioral program](./behavioral.md).

## Public surface

`Controller` is exported via the `plaited/controller` specifier. Construct one
instance per page, loaded as an async module script in `<head>`. (The UI
layer is consumed via its plugin context, not via `plaited` root imports —
reach the class from the integrating package.)

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

## The push model

This is the load-bearing concept: a Plaited page is **push-based**, not
pull-based. The controller does not fetch state and render client-side; it
opens a WebSocket to its serving agent and applies server-pushed messages:

| Server → browser message | What the Controller does |
|--------------------------|---------------------------|
| `render` | Apply HTML to `[p-target]` elements per the `swap` mode |
| `attrs` | Set/remove attributes on `[p-target]` elements |
| `dispatch_custom_event` | Fire a `CustomEvent` on the target |
| `navigate` | Navigate the page (URL change) |

User interactions emit `ui_event` messages back to the agent, which decides
what to render in response. The agent — running a behavioral program — is
the source of truth for what the page shows; the Controller is the DOM
applier.

## When to use which

- **Wiring a multi-page app**: one `Controller` per page, constructed in the
  page's `<head>` async module. The WebSocket URL is derived from the page's
  origin.
- **Binding interactive elements**: declare `p-trigger` and `p-form`
  attributes in the DOM; the Controller wires them to emit `ui_event` messages
  on user interaction. No manual `addEventListener` in your code.
- **Page lifecycle**: the `onPage*` hooks fire on `pagereveal`/`pageswap`/
  `pagehide`/`pageshow`. The browser owns document-bound teardown (listeners,
  sockets, timers) on unload and bfcache freeze; the Controller does **not**
  force-close the socket on `pagehide` so a queued snapshot can flush during
  teardown.

## A common wiring mistake to avoid

Calling `Controller` methods directly to mutate the DOM. The Controller is a
**message applier**, not a DOM API — `render`/`attrs`/`dispatch_custom_event`/
`navigate` arrive as server-pushed messages and are dispatched internally,
not called by your code. If you find yourself reaching for a Controller method
to change the page, the correct path is to emit a `ui_event` (via a
`p-trigger`/`p-form` declaration) and let the agent's behavioral program
respond with a server-pushed `render`. The DOM is downstream of the agent,
not the other way around.

The second common mistake: expecting the WebSocket to be manually managed.
The Controller handles connect, retry (with bounded backoff), and message
queuing during disconnect internally. Do not wrap it in your own
reconnection logic — that duplicates the built-in behavior and races with
the Controller's own retry.

## Going deeper

The public surface above is importable. Deeper internals are reachable by
resolving the public specifier to its backing file and inspecting with the
TypeScript LSP CLI — no hardcoded source paths, so the examples survive
refactors that move impl files.

### Resolve the specifier and enumerate exports

```bash
# Step 1 — resolve the specifier to its backing file (barrel)
bun -e 'console.log(Bun.resolveSync("plaited/controller", process.cwd()+"/"))'
# → /path/to/src/controller.ts

# Step 2 — read the barrel to find the backing module that exports your symbol
# The barrel re-exports: export * from './controller/controller.ts'
#                       export * from './controller/controller.types.ts'
# Pick the module that declares the symbol you need (e.g. src/controller/controller.ts)

# Step 3 — enumerate the backing module's symbols with documentSymbol
plaited typescript-lsp '{"mode":"execute","file":"<resolved-path>","requests":[{"method":"textDocument/documentSymbol","params":{"textDocument":{"uri":"file://<resolved-path>"}}}]}'
```

`documentSymbol` returns each symbol in the backing module with its kind
and `range.start` location — hover the symbol you want using the position
from the output (no hardcoded line numbers).

### Fetch one symbol's TSDoc and type

```bash
# Step 4 — fetch one symbol's TSDoc and type (use range.start from Step 3 as the position)
plaited typescript-lsp '{"mode":"execute","file":"<resolved-path>","requests":[{"method":"textDocument/hover","params":{"textDocument":{"uri":"file://<resolved-path>"},"position":{"line":0,"character":0}}}]}'
```

Returns the `/** ... */` block plus the resolved type signature — the deeper
"what it does / how to debug it" content for the symbol.

### Getting the position right (common mistakes)

`hover` requires `position`; `documentSymbol` does not. These are easy to
mix up:

✓ `hover` with `position` → the TSDoc at that symbol.
✗ `hover` **without** `position` → empty/whole-file result, not an error.
✗ `documentSymbol` **with** `position` → ignored; still returns all symbols.

`method` lives inside `requests[]`, not at the top level:

✓ `{"mode":"execute","file":"...","requests":[{"method":"textDocument/hover","params":{...}}]}`
✗ `{"mode":"execute","file":"...","method":"textDocument/hover"}` → `method` is
  silently dropped and the request does nothing.

## See also

- [Renderer](./renderer.md) — the SSR counterpart; same `render`/`attrs`
  commands applied to an HTML string instead of a live DOM.
- [Behavioral](./behavioral.md) — the runtime whose handlers emit the
  `render`/`attrs` messages the Controller applies.
