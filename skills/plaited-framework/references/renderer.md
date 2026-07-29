# Renderer

Reference for an agent assisting an engineer in wiring up server-side
rendering for a Plaited app. The `Renderer` is the SSR counterpart to the
browser-side [`Controller`](./controller.md): where the Controller applies
`render`/`attrs` (plus `dispatch_custom_event`/`navigate`) to a live DOM over
a WebSocket, the Renderer applies `render`/`attrs` to an HTML string held in
memory, synchronously, in a Bun process. The pair is the UI layer driven by a
[behavioral program](./behavioral.md)'s handlers.

## Public surface

`Renderer` (class) and `RendererResult` (type) are reachable via type-only
imports from the package root (`plaited`). The `Renderer` class is exported
as a type via `export type *` — use `import type { Renderer } from 'plaited'`
for the instance type. `RendererResult` is also a type-only re-export from
the package root. The class is not a value-level export from any public
specifier; construct it from its source file or the integrating package.

Construct with the initial HTML string, held as owned mutable state:

```ts
const renderer = new Renderer({ html: initialHtml })
```

The entire public surface is three things:

| Member | Purpose |
|--------|---------|
| `render({ target, html, swap, id, match })` | Apply `html` to `[p-target]` elements per `swap` mode |
| `attrs({ target, attr, id, match })` | Set/remove attributes on `[p-target]` elements |
| `get html()` | Read the current buffer state |

Both `render` and `attrs` return a `RendererResult` whose `detail` is
`{ id, target, html }` — `html` is the **new buffer state** so the calling
behavioral-program handler can thread state forward.

## The strict-subset relationship

The Renderer is a deliberate subset of the Controller. Everything needing a
live DOM is dropped:

- No WebSocket transport (no push loop — the Renderer is called directly by
  your handlers).
- No page lifecycle (`pagereveal`/`pageswap`/`pagehide`/`pageshow`).
- No `p-trigger` / `p-form` DOM binding (no user input on the server).
- No `dispatch_custom_event`, no `navigate` (those need a live page).

What remains is exactly the `render`/`attrs` transform applied to a string.
If a behavioral-program handler needs SSR, it calls `Renderer.render` /
`Renderer.attrs` directly; for browser-side push, the same commands travel
as WebSocket messages and the Controller applies them to the live DOM.

## When to use which

- **SSR / pre-render**: a behavioral-program handler calls `render`/`attrs`
  on a `Renderer` to produce an HTML string for an initial page load or a
  snapshot, synchronously.
- **State threading**: because each `render`/`attrs` returns the new buffer
  state in `RendererResult.detail.html`, chain calls by feeding the result
  into the next `Renderer` (one instance owns one buffer — construct a new
  `Renderer` per independent document).
- **Browser push**: use the [`Controller`](./controller.md), not the
  Renderer — the live DOM and WebSocket are the Controller's job.

## Security and the zero-match contract

Two things to know that distinguish the Renderer from a naive string
transformer:

1. **Payload HTML is validated/escaped before selector match.**
   `Renderer.render` runs `validateAndEscapeHtml` on the incoming `html`
   payload *before* matching `[p-target]`. An XSS-laden or schema-invalid
   payload throws `ValidationError` **even when no element matches** — the
   Renderer never silently accepts a dangerous payload. The behavioral
   engine's `feedback_error` snapshot captures the throw.

2. **It never throws `ElementNotFoundError`.** The Controller throws that
   only when a DOM node is `null` mid-iteration; for a string transform via
   `HTMLRewriter`, zero matches simply means the element handler doesn't fire,
   and the buffer is left unchanged. There is no genuine lookup-failure mode
   for a string transform — a command that matches nothing is a no-op, not an
   error.

## A common wiring mistake to avoid

Constructing one `Renderer` and reusing it across multiple documents. Each
instance owns one mutable HTML buffer; `render`/`attrs` mutate that buffer
in place and re-store it. If you reuse an instance for a second document,
the second document's initial state is the first document's *post-render*
state, not a fresh string. Construct a new `Renderer({ html })` per
independent document.

The second common mistake: `await`-ing `render`/`attrs`. They are
**synchronous** — Bun's `HTMLRewriter.transform(string)` returns a string
synchronously, and the element handlers contain no `await`. They return a
`RendererResult` directly, not a `Promise<RendererResult>`. The behavioral
handler that *calls* them may be async (that's the handler's concern), but
the Renderer's methods themselves are not.

## Going deeper

The public surface above is importable. Deeper internals are reachable by
resolving the public specifier to its backing file and inspecting with the
TypeScript LSP CLI — no hardcoded source paths, so the examples survive
refactors that move impl files.

### Resolve the specifier and enumerate exports

```bash
# Step 1 — resolve the specifier to its backing file (barrel)
cd packages/framework && bun -e 'console.log(Bun.resolveSync("plaited", process.cwd()+"/"))'
# → /path/to/packages/framework/src/main.ts

# Step 2 — read the barrel to find the backing module that exports your symbol
# The barrel re-exports: export * from './main/behavioral.ts'
#                       export type * from './main/behavioral.types.ts'
#                       export { ... } from './main/frontier-analysis.ts'
#                       export * from './main/renderer.ts'
# Pick the module that declares the symbol you need (e.g. src/main/renderer.ts)

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

- [Controller](./controller.md) — the browser counterpart; same `render`/
  `attrs` commands applied to a live DOM via WebSocket.
- [Behavioral](./behavioral.md) — the runtime whose handlers call
  `Renderer.render` / `Renderer.attrs` to drive SSR.
