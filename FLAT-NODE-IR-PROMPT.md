# Task: Flat-Node UI IR — replacing `h()`/markers with a kinded-ref adjacency model

**Worktree task.** Create the worktree first:
`git worktree add .worktrees/flat-node-ir dev`

**Local working task — not a PR. Not pushed to remote.** Work proceeds as three
sequenced commits on a local branch; the author reviews after a later session.
No PR template, no `gh pr create`, no PR-description-lint. Commit messages
still follow conventional-commits (commitlint runs locally) but body wrapping
is the only hook gate that matters.

**Follow [AGENTS.md](AGENTS.md) rules.** This task is governed by the same
conventions as all repo work — code quality gate, testing standards, module
organization, TSDoc, etc.

**Skills and guidelines to load and obey:**
- `tdd` — test-first throughout
- `karpathy-guidelines` — surgical changes, surface assumptions, verifiable success criteria
- Minimal-Implementation Directive (in [AGENTS.md](AGENTS.md) §Core Conventions)

TDD throughout. Each commit is a vertical slice that leaves the repo green
(`bun --bun tsc --noEmit` + targeted tests).

---

## Why (the architectural decisions already locked with the author — do not re-litigate)

Plaited's UI layer currently builds HTML via `h()` (hyperscript in
`src/client/template.ts`) which recursively nests children and flattens to
`html: string[]`. Binding hooks (`$for`/`$val`/`$switch`/`$with`/`$slot`) emit
**comment markers** (`<!--? for id -->`) into that string, and a regex rewriter
was planned to resolve them. We are abandoning that path for a structural model
because:

1. **A2UI's flat adjacency list** (`{id, type, props, children: [id...]}`) is
   easier for an LLM to generate, updateable by ID, and separates structure
   from data.
2. **Kinded `$ref` objects** are
   schema-enforceable and position-constrained — strictly better than scanning
   comment markers with regex.

### Locked decisions (encode these exactly; do not redesign)

- **No `HTMLRewriter`.** The runtime is Bun, but `HTMLRewriter` is a streaming
  single-pass token rewriter — wrong shape for range markers with per-iteration
  substitution. Use a recursive walk over a node tree.
- **Drop `h()` entirely.** Replace with a flat-node IR + a `materialize` bridge.
  Migrate the one `ssr.ts` callsite.
- **Flat adjacency-list IR.** `TemplateObject` becomes a flat list of nodes
  with ID refs for children (A2UI model), not a nested tree.
- **Kinded-ref binding medium** (not comment markers). A value is either a
  literal or `{$<kind>: <value>}`. The 6 kinds:

  | Kind | Legal in | Resolves via | Resolves to |
  |---|---|---|---|
  | `$path` | any value field (text, attrs, children) | runtime path-resolver callback (async, IoC) | a data value / array / discriminant |
  | `$template` | `children` | template catalog | child nodes (reusable template by id) |
  | `$switch` | `children` | runtime path-resolver (discriminant) + catalog (case bodies) | selected case's child nodes |
  | `$token` | CSS property values | token catalog | `var(--…)` string |
  | `$keyframe` | `animation`/`animation-name` values | keyframe catalog | hashed keyframe id string |
  | `$style` | node `style[]` | style catalog | `{classNames, stylesheets}` |

- **`$path` uses JSON Pointer (RFC 6901)** — `/user/name`, `/cart/items/0`.
  Scope = path-prefix auto-narrowing inside a per-item template (A2UI model:
  `/name` under `/items/0` → `/items/0/name`). No separate data channel; the
  path prefix IS the scope.
- **One runtime IoC callback:** `pathResolver: (path: string, scope: string[]) => Promise<unknown>`.
  Catalog-bound refs (`$token`/`$keyframe`/`$style`/`$template`) resolve
  against static catalogs (in-memory maps or JSONL); only `$path` is async/IoC.
- **CSS Proxy DSL** — all CSS factory methods live on a `css` Proxy and **emit
  descriptors/ref-objects, never closures**. No `createTokens`-style function
  returning `() => var(--x)`. Methods:
  - `css.$token('/colors/primary')` → `{$token: '/colors/primary'}`
  - `css.$keyframe('/animations/fadeIn')` → `{$keyframe: '/animations/fadeIn'}`
  - `css.$style('button.base')` → `{$style: 'button.base'}`
  - `css.$root({ '--color-text': ... })` → `:root` stylesheet descriptor
  - `css.$host({ color: ... })` → `:host` stylesheet descriptor
  - `css.$top({ '@view-transition': {...} })` → top-level at-rule descriptor
  - `css.$class('card', { border: '1px solid' })` → hashed class descriptor
  - `css.keyframes('fadeIn', {...})` → `@keyframes` descriptor
- **Position-constrained refs (§3.3 principle).** Which kinds are legal is
  schema-enforced per field position (see table above). A `$token` in a
  `text` field is a schema error, not a runtime surprise.
- **Output bridge to the controller protocol:** `materialize(nodes) → { html: string, stylesheets: string[] }`
  matching `RenderMessage.detail` (`src/shared/shared.schemas.ts`). The
  controller (`src/client/controller.ts`) is unchanged — it still receives
  resolved `html` + `stylesheets` and never sees nodes/refs.
- **The regex patterns already shipped in `src/shared/shared.constants.ts`
  (`FLOW_CONTROL_*`, `TOKEN_REF_PATTERN`, `KEYFRAME_REF_PATTERN`) survive as a
  one-way ingestion parser** — legacy marker-bearing HTML strings → kinded-ref
  nodes. They are the bridge from the old medium to the new IR, NOT the
  resolution medium.

### Files in play (read before writing — reuse, don't reimplement)

- `src/client/template.ts` — `h()`, `fragment`, `$`-helpers. **Being replaced.**
- `src/client/template.schemas.ts` — `TemplateObject`, `DetailedHTMLAttributes`,
  per-tag attribute schemas. Reuse the attribute-validation work; relocate.
- `src/client/template.constants.ts` — `FLOW_CONTROL_HELPERS`, `SCALE`, etc.
- `src/client/css.ts` — `createStyles`, `createKeyframes`. Logic reused as
  Proxy method bodies; the function API dissolves into the Proxy.
- `src/client/css.schemas.ts` — auto-gen CSS property schemas using
  `TOKEN_REF_PATTERN`/`KEYFRAME_REF_PATTERN` regex. **Migrate to object-ref
  form** (`{$token: z.string()}`); the regex leaves this file.
- `src/client/css.types.ts` — already has the registry shape
  (`tokens?: Map<...>`, `keyframes?: Map<...>`). Align.
- `src/client/css.constants.ts` — `CSS_RESERVED_KEYS`.
- `src/client/resolve-template-refs.ts` — old `resolveDataPath` (dotted path
  resolver) and `resolveTemplateRefs`. Read to understand the old pattern, then
  delete in Commit 1 — nothing in the new architecture needs it.
- `src/client/ssr.ts` — one `h()` callsite to migrate; the join+inject logic
  stays.
- `src/shared/shared.constants.ts` — the regex patterns (ingestion parser).
- `src/shared/shared.schemas.ts` — `RenderMessage` (the output contract).
- `scripts/generate-css-schemas.spec.ts` + `src/cli/css-schemas.ts` — the
  auto-generator; update to emit object-ref form.

---

## Commit 1 — Foundation: flat-node IR + kinded-ref vocabulary (schemas/types + ingestion parser)

**Goal:** establish the type/schema foundation everything validates against.
No runtime resolution yet. No Proxy. No materialize. Just the IR shape, the 6
ref schemas, position-constraint validation, and the regex→ref ingestion bridge
that validates the already-shipped `shared.constants.ts` patterns.

### Scope (TDD, one behavior at a time)

1. **`FlatNode` schema** — `{ id: string, tag: string, attrs?: Record<string, unknown>, text?: ..., style?: {$style}[], children?: ChildRef[] }`
   where `ChildRef` is `string` (node id) | `{$path, $template}` | `{$template}` | `{$switch}`. Start with the minimal shape; grow per test.
2. **The 6 kinded-ref schemas** — `{$path: z.string()}`, `{$token: z.string()}`,
   `{$keyframe: z.string()}`, `{$style: z.string()}`, `{$template: z.string()}`,
   `{$switch: z.object({path, cases: Record<string, string[]>, default?: string[]})}`.
   Discriminated unions; `.describe()` on top-level per AGENTS.md CLI-schema rule if exposed via CLI.
3. **Position-constraint validation** — a `$token` in `text` is an error; a
   `$path` in `style[]` is an error; `$keyframe` only in `animation`/`animation-name`. Test both branches (valid + invalid) for each constraint.
4. **JSON Pointer helper** — `resolvePointer(data, pointer)` replacing the
   dotted `resolveDataPath` in `resolve-template-refs.ts`. RFC 6901 semantics
   (`/`, `/0`, `/a/b`, `~1`/`~0` escaping). Pure function; reuse from stdlib if
   available (check first — Minimal-Implementation step 3).
5. **Ingestion parser** — `parseMarkers(html: string): FlatNode[]` using the
   `FLOW_CONTROL_*` / `TOKEN_REF_PATTERN` / `KEYFRAME_REF_PATTERN` regex from
   `shared.constants.ts` to convert a marker-bearing HTML string into
   kinded-ref nodes. This is the bridge validating the regex work. Tests use
   static marker-bearing HTML fixture strings (shaped like what the current
   `template.ts` `$`-helpers produce) — not live imports from `template.ts`.
   This keeps the parser and its tests self-contained for deletion in Commit 2.
   Generate the fixture strings once by inspecting the current output format.
6. **Delete `resolve-template-refs.ts`** — the old dotted-path resolver and
   `resolveTemplateRefs` are dead code in the new model. Remove the file, its
   test spec, and its re-export in `src/client.ts`.

### Verify before commit
- `bun --bun tsc --noEmit` clean for touched files.
- `bun test` for the new schema/parser spec.
- `scripts/generate-css-schemas.spec.ts` still passes (don't break the generator yet — that's a follow-up, unless this commit changes the emitted shape, in which case update generator + spec together).
- **Commit message:** `feat(client): flat-node IR + kinded-ref vocabulary with marker ingestion parser`

---

## Commit 2 — Authoring surface: Proxy DSL (`ui` + `css` proxies)

**Goal:** agents and humans emit flat nodes / ref-objects via Proxy
metaprogramming. Builds on Commit 1's types. No resolution yet — the Proxy
produces IR, it doesn't execute it.

### Scope (TDD, one behavior at a time)

1. **`css` Proxy** — `css.$token`, `css.$keyframe`, `css.$style`, `css.$root`,
   `css.$host`, `css.$top`, `css.$class`, `css.keyframes`. Each returns the
   descriptor/ref-object from Commit 1's schemas. **No closures, no `.stylesheets`-on-a-function.** Reuse `createStyles`/`createKeyframes` logic from `css.ts` as the method bodies (extract, don't rewrite — read first).
2. **`ui` Proxy** — `ui.<tag>(...)` accumulates a `FlatNode`; chained
   `.id(...)`, `.attrs(...)`, `.style(...)`, `.children(...)` return the proxy
   for chaining; a terminal `.node()` (or Symbol.toPrimitive / finalize)
   returns the `FlatNode`. Property access for tags (`ui.div`, `ui['my-element']`).
   Children accept node-ids, `$template`/`$path`/`$switch` refs, or nested proxy calls.
3. **Reusable templates** — a template factory (function returning a
   configured `ui` proxy or a `FlatNode[]`), referenced via `{$template: 'id'}`.
   This is the agent-generates-reusable-templates unit.
4. **Migrate `ssr.ts`** — replace its one `h('script', ...)` callsite with the
   Proxy. `ssr()`'s join + `<style>` inject + `:host`→`:root` logic stays.
5. **Delete `h()` / `$`-helpers / `fragment`** from `template.ts` once nothing
   imports them (search first; `resolve-template-refs.ts` only mentions `h()` in comments).
   Also delete the ingestion parser from Commit 1 — markers don't exist in the
   target end state; the parser was a bootstrap-only bridge.

### Verify before commit
- `bun --bun tsc --noEmit` clean.
- New Proxy spec: each method emits the correct ref-object shape; chaining accumulates correctly; terminal returns a valid `FlatNode`.
- `ssr.ts` migration: existing `ssr` snapshots/tests still pass (behavior unchanged).
- Any test importing the old `$`-helpers is updated or removed (no orphans).
- **Commit message:** `feat(client): Proxy DSL authoring surface for flat-node IR, drop h()`

---

## Commit 3 — Resolver + materializer

**Goal:** walk flat nodes, resolve kinded-refs via the one `pathResolver`
callback + catalog fetchers, and materialize to `{html, stylesheets}` for the
controller protocol. This is where the IoC inversion lands.

### Scope (TDD, one behavior at a time)

1. **`resolve(nodes, { pathResolver, catalogs })`** — recursive walk.
   - `$path` → `await pathResolver(path, scope)`; scope is the JSON-Pointer
     prefix stack (auto-narrowed per array item: rendering `/items` with
     `$template` per item makes `/name` resolve as `/items/0/name`).
   - `$template` → fetch child nodes from the template catalog by id; resolve
     them in the current scope.
   - `$switch` → `discriminant = await pathResolver(switch.path, scope)`;
     select `cases[discriminant]` else `default`; resolve those child nodes.
   - `$token`/`$keyframe`/`$style` → resolve against static catalogs (in-memory
     Maps; align with `css.types.ts` registry shape).
   - **Concurrency:** fan out independent subtrees (`Promise.all` over
     siblings) — a page with 20 `$path` fetches should take ~1× not 20×.
2. **`materialize(resolvedNodes) → { html: string, stylesheets: string[] }`** —
   the bridge to `RenderMessage.detail`. Reuse `ssr.ts`'s escaping/dedup/`:host`→`:root` logic (extract, don't reimplement). Output shape must match `src/shared/shared.schemas.ts` `RenderMessage.detail` exactly.
3. **Error policy:** callbacks throw → `resolve` rejects; no try/catch in the
   walker (per AGENTS.md behavioral-handler rule — let errors propagate). Test
   that a throwing `pathResolver` rejects the whole resolve.
4. **End-to-end test:** flat nodes with nested `$path`+`$template` (a list
   from data) → resolve with a stub `pathResolver` returning fixture data →
   `materialize` → assert `{html, stylesheets}` matches a snapshot. This is
   the tracer bullet proving the whole IR→wire path.

### Verify before commit
- `bun --bun tsc --noEmit` clean.
- Resolver spec: each kind resolves correctly; scope auto-narrows; concurrency
  fans out; throwing callbacks reject.
- Materializer spec: output matches `RenderMessage.detail` schema shape;
  dedup works; escaping preserved.
- E2E spec green.
- **Commit message:** `feat(client): kinded-ref resolver and materializer bridging flat-node IR to RenderMessage`

---

**See [AGENTS.md](AGENTS.md) §Core Conventions — Minimal-Implementation Directive** — the
full directive lives there now; this task obeys it.
