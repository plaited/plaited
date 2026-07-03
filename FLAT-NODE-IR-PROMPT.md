# Task: Flat-Node UI IR — replacing `h()`/markers with a kinded adjacency model

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
- `mdn-web-docs` — read MDN Proxy/Reflect docs before implementing the Proxy DSL
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
2. **Kinded `$ref` objects** are schema-enforceable and position-constrained —
   strictly better than scanning comment markers with regex.

### Locked decisions (encode these exactly; do not redesign)

- **No `HTMLRewriter`.** The runtime is Bun, but `HTMLRewriter` is a streaming
  single-pass token rewriter — wrong shape for range markers with per-iteration
  substitution. Use a recursive walk over a node tree.
- **Drop `h()` entirely.** Replace with a flat-node IR + a `materialize` bridge.
  Migrate the one `ssr.ts` callsite.
- **Kinded adjacency-list IR.** Everything is a node with a `kind` discriminator.
  No more `TemplateObject`. The 10 kinds:

  | Kind | What it is | Resolves via | Resolves to |
  |---|---|---|---|
  | `element` | HTML/SVG tag node | static catalog (template) | serialized HTML |
  | `class` | CSS class descriptor | static catalog | hashed class + stylesheet entry |
  | `host` | `:host` stylesheet | static catalog | stylesheet entry |
  | `root` | `:root` / `--*` declarations | static catalog | stylesheet entry |
  | `top` | top-level at-rule (`@view-transition`, etc.) | static catalog | stylesheet entry |
  | `keyframe` | `@keyframes` descriptor | static catalog | hashed keyframe + stylesheet entry |
  | `$token` | token ref in a CSS value | token catalog | `var(--…)` string |
  | `$style` | style ref on an element | style catalog | `{classNames, stylesheets}` |
  | `$template` | reusable template ref | template catalog | child nodes |
  | `$switch` | conditional template | path-resolver + case catalog | selected child nodes |
  | `$path` | dynamic value ref at any position | async path-resolver | resolved data value |

- **`$path` uses JSON Pointer (RFC 6901)** — `/user/name`, `/cart/items/0`.
  Scope = path-prefix auto-narrowing inside a per-item template (A2UI model:
  `/name` under `/items/0` → `/items/0/name`). No separate data channel; the
  path prefix IS the scope.
- **One runtime IoC callback:** `pathResolver: (path: string, scope: string[]) => Promise<unknown>`.
  Catalog-bound refs (`$token`/`$keyframe`/`$style`/`$template`) resolve
  against static catalogs (in-memory maps or JSONL); only `$path` is async/IoC.
- **Single `ui` Proxy** — one namespace for the entire authoring surface. Every
  method on `ui` produces a kinded node:
  - `ui.div(...)` → `{ kind: 'element', tag: 'div', ... }`
  - `ui.$token('/colors/primary')` → `{ kind: '$token', path: '/colors/primary' }`
  - `ui.$class('card', { border: '1px solid' })` → `{ kind: 'class', name: 'card', ... }`
  - `ui.$host({ color: 'red' })` → `{ kind: 'host', rules: ... }`
  - `ui.$root(...)`, `ui.$top(...)`, `ui.$keyframe(...)`, `ui.$style(...)`
  - `ui.$template('header')`, `ui.$switch(...)`, `ui.$path('/user/name')`
- **`$`-prefixed methods** produce ref/descriptor nodes (short-lived, consumed
  during materialization). **Unprefixed tag methods** produce element nodes (the
  rendered output). Same Proxy, same import, same `get` trap branching on
  `prop.startsWith('$')`.
- **Position-constrained refs.** Which kinds are legal is schema-enforced per
  field position. A `$token` in a `text` field is a schema error, not a runtime
  surprise.
- **Output bridge:** `materialize(nodes) → TemplateObject` — the same `{ html: string[],
  stylesheets: string[], scale, $: TEMPLATE_OBJECT_IDENTIFIER }` shape that `ssr.ts`
  already consumes. The controller or SSR caller wraps the `TemplateObject` into
  `RenderMessage.detail` (`html: tpl.html.join(''), stylesheets: tpl.stylesheets`).
  The controller (`src/client/controller.ts`) is unchanged — it still receives
  resolved `html` + `stylesheets` and never sees nodes/refs.
- **JIT resolution.** The materializer walks kinded nodes in one pass. When it
  encounters a ref it resolves it immediately. Errors surface at the point of
  failure, giving the agent a precise signal to correct.

### Files in play (read before writing — reuse, don't reimplement)

- `src/client/template.ts` — `h()`, `fragment`, `$`-helpers. **Being replaced.**
  The escaping logic, boolean attribute handling, void tag handling, script
  policy, `p-trigger` serialization, shadow DOM inline styles, and `p-scale`
  enforcement must carry over into the materializer.
- `src/client/template.schemas.ts` → **rename to `src/client/html.schemas.ts`**.
  Contains `DetailedHTMLAttributes`, per-tag attribute schemas. Update each
  attribute field to accept `valueOrRef = z.union([primitive, pathRefSchema])`
  so JSON Pointer refs are valid everywhere. Also add the kinded FlatNode
  schemas here.
- `src/client/template.constants.ts` — `VOID_TAGS`, `BOOLEAN_ATTRS`,
  `CUSTOM_ELEMENT_TAG_PATTERN`, `SITE_ROOT_JAVASCRIPT_PATH_PATTERN`,
  `PRIMITIVES`, `VALID_PRIMITIVE_CHILDREN`, `SCALE`, `P_TRIGGER`, etc.
  Reuse these in the materializer.
- `src/client/css.ts` — `createStyles`, `createKeyframes`. Logic reused as
  `ui.$class`/`ui.$host`/etc. method bodies. The function API dissolves into
  the Proxy.
- `src/client/css.schemas.ts` — auto-gen CSS property schemas. **Migrate from
  regex string refs to object-ref form** (`{$token: z.string()}`, `{$path: z.string()}`).
  Every property becomes `z.union([value, tokenRef, pathRef])`.
- `src/client/css.types.ts` — registry shape (`tokens?`, `keyframes?`, etc.).
  Align.
- `src/client/css.constants.ts` — `CSS_RESERVED_KEYS`.
- `src/client/ssr.ts` — one `h()` callsite to migrate; the join+inject logic
  stays.
- `src/shared/shared.constants.ts` — `FLOW_CONTROL_*`, `TOKEN_REF_PATTERN`,
  `KEYFRAME_REF_PATTERN` regex patterns (used only by the ingestion parser,
  deleted in Commit 2).
- `src/shared/shared.schemas.ts` — `RenderMessage` (the output contract).
- `scripts/generate-css-schemas.spec.ts` + `src/cli/css-schemas.ts` — the
  auto-generator; update to emit object-ref form instead of regex strings.

---

## Commit 1 — Foundation: kinded node schemas + CSS ref migration

**Goal:** establish the type/schema foundation everything validates against.
No Proxy. No materialize. Just the kinded IR schemas, `valueOrRef` unions,
and migration of CSS schemas from regex strings to object-ref form.

### Scope (TDD, one behavior at a time)

1. **Kinded `FlatNode` schema in `html.schemas.ts`** — discriminated union on
   `kind`. Start with the minimal element shape and grow per test. Types:
   - `element` — `{ kind: 'element', tag: string, attrs, children, etc. }`
   - `class` — `{ kind: 'class', name: string, rules: Record<string, unknown> }`
   - `host` — `{ kind: 'host', rules: Record<string, unknown> }`
   - `root` — `{ kind: 'root', declarations: Record<string, unknown> }`
   - `top` — `{ kind: 'top', atRule: string, rules: Record<string, unknown> }`
   - `keyframe` — `{ kind: 'keyframe', ident: string, frames: ... }`
   - ref kinds (`$token`, `$style`, `$template`, `$switch`, `$path`)

2. **`valueOrRef` helper** — reusable `z.union([z.string(), z.number(), z.boolean(), pathRefSchema])`
   spread into every attribute and CSS property schema. Follows the same union
   pattern already used in `css.schemas.ts`.

3. **Rename `template.schemas.ts` → `html.schemas.ts`** — carry over every
   attribute schema. Each scalar field now uses `valueOrRef` so `$path` is
   valid in any attribute position. Update all imports.

4. **CSS schemas: regex → object-ref** — update `css.schemas.ts` (and the
   generator in `scripts/generate-css-schemas.spec.ts` + `src/cli/css-schemas.ts`)
   to emit:
   ```ts
   const tokenRefSchema = z.object({ $token: z.string() })
   const keyframeRefSchema = z.object({ $keyframe: z.string() })
   const pathRefSchema = z.object({ $path: z.string() })
   ```
   Every CSS property becomes `z.union([value, tokenRef, pathRef])`. Remove
   imports of `TOKEN_REF_PATTERN`/`KEYFRAME_REF_PATTERN` from `css.schemas.ts`.

5. **JSON Pointer helper** — `resolvePointer(data, pointer)` in `src/client/`.
   RFC 6901 semantics (`/`, `/0`, `/a/b`, `~1`/`~0` escaping). Pure function;
   reuse from stdlib if available (check first — Minimal-Implementation step 3).

6. **Delete `resolve-template-refs.ts`** — the old dotted-path resolver and
   `resolveTemplateRefs` are dead code in the new model. Remove the file, its
   test spec, and its re-export in `src/client.ts`.

### Verify before commit
- `bun --bun tsc --noEmit` clean for touched files.
- `bun test` for the new schema specs.
- `scripts/generate-css-schemas.spec.ts` updated and passing (this commit
  changes the emitted CSS schema shape).
- No remaining imports of deleted files.
- **Commit message:** `feat(client): kinded FlatNode IR schemas + CSS ref migration to object-ref form`

---

## Commit 2 — Authoring surface: single `ui` Proxy

**Goal:** agents and humans emit kinded nodes via a single `ui` Proxy in
`src/client/ui.ts`. Builds on Commit 1's types. No resolution yet — the Proxy
produces IR, it doesn't execute it.

### Scope (TDD, one behavior at a time)

1. **Read MDN docs on Proxy and Reflect** (`mdn-web-docs` skill) before
   writing the Proxy handler. Understand `get` traps, `Reflect.get` forwarding,
   and the `receiver` parameter.

2. **`ui` Proxy** in `src/client/ui.ts` — single `get` trap branches on
   `prop.startsWith('$')`:
   - **`$`-prefixed** — `ui.$token(path)`, `ui.$class(name, rules)`,
     `ui.$host(rules)`, `ui.$root(declarations)`, `ui.$top(atRule, rules)`,
     `ui.$keyframe(ident, frames)`, `ui.$style(path)`, `ui.$template(id)`,
     `ui.$switch(config)`, `ui.$path(pointer)`. Each returns the corresponding
     kinded node from Commit 1's schemas.
   - **Bare tag name** — `ui.div(...)`, `ui['my-element'](...)` returns a
     chained builder (`.id()`, `.attrs()`, `.children()`, etc.) with a terminal
     `.node()` that returns the `{ kind: 'element', ... }` node.
   - Reuse `createStyles`/`createKeyframes` logic from `css.ts` as method
     bodies for `ui.$class`/`ui.$host`/`ui.$root`/`ui.$top`/`ui.$keyframe`
     (extract, don't rewrite).

3. **Migrate `ssr.ts`** — replace its one `h('script', ...)` callsite with
   `ui.script(...)`. `ssr()`'s join + `<style>` inject + `:host`→`:root` logic
   stays.

4. **Delete `h()` / `fragment` / `$`-helpers** from `template.ts` once nothing
   imports them.

5. **Delete the ingestion parser** from Commit 1 (if it was created) — markers
   and regex patterns have no place in the end state. Remove
   `FLOW_CONTROL_*`/`TOKEN_REF_PATTERN`/`KEYFRAME_REF_PATTERN` from
   `shared.constants.ts` if nothing else uses them.

### Verify before commit
- `bun --bun tsc --noEmit` clean.
- New `ui` Proxy spec: each method emits the correct kinded node shape; `ui.div()`
  chaining accumulates correctly; terminal `.node()` returns a valid element node.
- `ssr.ts` migration: existing `ssr` snapshots/tests still pass (behavior unchanged).
- No remaining imports of `h()`, `fragment`, `$`-helpers, or ingestion parser.
- **Commit message:** `feat(client): ui Proxy — single kinded-node authoring surface, drop h() and markers`

---

## Commit 3 — JIT materializer

**Goal:** walk kinded nodes in one pass, resolve refs on encounter, and
materialize to `{html, stylesheets}` for the controller protocol. JIT
resolution surfaces errors at the point of failure.

### Scope (TDD, one behavior at a time)

1. **`materialize(nodes, { pathResolver, catalogs }) → TemplateObject`**
   — single-pass walk over kinded nodes producing the same `{ html: string[],
   stylesheets: string[], scale, $: TEMPLATE_OBJECT_IDENTIFIER }` shape that
   `ssr.ts` and `fragment` already consume. The controller extracts `.html.join('')`
   and `.stylesheets` when wrapping into `RenderMessage.detail`. The `TemplateObject`
   type stays in `html.schemas.ts` (renamed from `template.schemas.ts`).
   - **`element`** — serialize tag, attrs (with `htmlEscape`, `BOOLEAN_ATTRS`,
     `VOID_TAGS`, `on*` rejection, script policy, `p-trigger` serialization,
     `p-scale` enforcement), children, shadow DOM inline styles. All the logic
     currently in `template.ts`'s `h()` carries over here.
   - **`class`/`host`/`root`/`top`/`keyframe`** — resolve `$token`/`$keyframe`/`$path`
     refs in their rules immediately, emit hashed descriptors + stylesheet entries.
   - **`$token`/`$style`** — resolve against static catalogs (in-memory Maps;
     align with `css.types.ts` registry shape).
   - **`$path`** — `await pathResolver(path, scope)`; scope is the JSON-Pointer
     prefix stack (auto-narrowed per array item).
   - **`$template`** — fetch child nodes from template catalog by id; resolve
     them in current scope.
   - **`$switch`** — `discriminant = await pathResolver(switch.path, scope)`;
     select `cases[discriminant]` else `default`; resolve those child nodes.
   - **Concurrency:** fan out independent subtrees (`Promise.all` over
     siblings) — a page with 20 `$path` fetches should take ~1× not 20×.

2. **Error policy:** callbacks throw → `materialize` rejects; no try/catch.
   Let errors propagate so the agent gets a precise failure signal at the
   offending node.

3. **End-to-end test:** kinded nodes with nested `$path`+`$template` (a list
   from data) → materialize with a stub `pathResolver` returning fixture data →
   assert `{html, stylesheets}` matches a snapshot. This is the tracer bullet
   proving the whole IR→wire path.

### Verify before commit
- `bun --bun tsc --noEmit` clean.
- Materializer spec: each kind resolves correctly; escaping, boolean attrs,
  void tags, script policy all preserved from old `template.ts` behavior.
- E2E spec green.
- **Commit message:** `feat(client): JIT materializer — one-pass resolve-and-serialize over kinded nodes`

---

**See [AGENTS.md](AGENTS.md) §Core Conventions — Minimal-Implementation Directive** — the
full directive lives there now; this task obeys it.
