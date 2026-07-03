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
- **Drop `h()` entirely.** Replace with kinded FlatNode IR + `Renderer` class
  in `src/client/renderer.ts`. Migrate the one `ssr.ts` callsite.
- **Kinded adjacency-list IR.** Everything is a node with a `kind` discriminator.
  Kind values: `element` for HTML/SVG tags; `$class`, `$host`, `$root`, `$top`,
  `$keyframe` for CSS descriptors; `$token`, `$style`, `$template`, `$switch`,
  `$path` for refs.
- **Single `ui` Proxy** — all methods are `$`-prefixed (`ui.$element(tag, opts)`,
  `ui.$class(name, rules)`, `ui.$host(rules)`, etc.). Every call returns a
  FlatNode immediately. No bare tag names, no chaining. The `get` trap branches
  on `prop.startsWith('$')`.
- **CSS descriptors live in the FlatNode[] alongside element nodes.** The agent
  sends one flat array. The `Renderer` walks it — when it encounters `$class`,
  `$host`, `$root`, `$top`, or `$keyframe`, it resolves refs in their rules
  and emits stylesheet entries. When it encounters `element`, it serializes
  HTML. Everything in one pass, JIT.
- **`$template` vs `$switch`** are distinct kinds. `$template` fetches known
  child nodes from a catalog by path. `$switch` evaluates a path, selects a
  case branch, then renders those child nodes. Different resolution paths.
- **`$path` uses JSON Pointer (RFC 6901)** — `/user/name`, `/cart/items/0`.
  Scope = path-prefix auto-narrowing inside a per-item template. No separate
  data channel; the path prefix IS the scope.
- **One runtime IoC callback:** `pathResolver: (path: string, scope: string[]) => Promise<unknown>`.
  Catalog-bound refs resolve against static catalogs; only `$path` is async/IoC.
- **`valueOrRef` unions** on every attribute and CSS property value schema.
  Any position that accepts a literal also accepts `{$path: z.string()}`
  (or `{$token: z.string()}`, etc.). Follows the union pattern already
  established in `src/client/css.schemas.ts`.
- **Position-constrained refs.** Which kinds are legal is schema-enforced per
  field position. A `$token` in a `text` field is a schema error, not a runtime
  surprise.
- **Output: `TemplateObject`** — `{ html: string[], stylesheets: string[], scale, $: TEMPLATE_OBJECT_IDENTIFIER }`.
  The `Renderer` produces this shape. `ssr.ts` and the controller already
  consume it. The controller wraps it into `RenderMessage.detail` (`html: tpl.html.join('')`,
  `stylesheets: tpl.stylesheets`).
- **JIT resolution.** The `Renderer` walks kinded nodes in one pass. When it
  encounters a ref it resolves it immediately. Errors surface at the point of
  failure, giving the agent a precise signal to correct.

### Files in play (read before writing — reuse, don't reimplement)

- `src/client/renderer.ts` — the target file. Already stubbed with a `Renderer`
  class, private methods for each kind, and `static ssr(tpl)`.
- `src/client/template.ts` — `h()`, `fragment`, `$`-helpers. **Being replaced.**
  The escaping logic, boolean attribute handling, void tag handling, script
  policy, `p-trigger` serialization, shadow DOM inline styles, and `p-scale`
  enforcement must carry over into the `Renderer`.
- `src/client/html.schemas.ts` — already renamed from `template.schemas.ts`.
  Contains `TemplateObject`, `DetailedHTMLAttributes`, per-tag attribute
  schemas. Add the kinded FlatNode schemas here. Update each attribute field
  to accept `valueOrRef` unions.
- `src/client/html.constants.ts` — already renamed from `template.constants.ts`.
  `VOID_TAGS`, `BOOLEAN_ATTRS`, `CUSTOM_ELEMENT_TAG_PATTERN`,
  `SITE_ROOT_JAVASCRIPT_PATH_PATTERN`, `PRIMITIVES`, `VALID_PRIMITIVE_CHILDREN`,
  `SCALE`, `P_TRIGGER`, etc. Reuse in the `Renderer`.
- `src/client/css.ts` — `createStyles`, `createKeyframes`. Logic reused as
  method bodies in the `Renderer`'s CSS descriptor handling.
- `src/client/css.schemas.ts` — auto-gen CSS property schemas. **Migrate from
  regex string refs to object-ref form** (`{$token: z.string()}`, `{$path: z.string()}`).
  Every property becomes `z.union([value, tokenRef, pathRef])`.
- `src/client/css.types.ts` — registry shape. Align.
- `src/client/css.constants.ts` — `CSS_RESERVED_KEYS`.
- `src/client/ssr.ts` — one `h()` callsite to migrate; the join+inject logic
  stays. The `Renderer.ssr()` static method will eventually replace this.
- `src/shared/shared.schemas.ts` — `RenderMessage` (the output contract).
- `scripts/generate-css-schemas.spec.ts` + `src/cli/css-schemas.ts` — the
  auto-generator; update to emit object-ref form instead of regex strings.

---

## Commit 1 — Foundation: kinded node schemas + CSS ref migration

**Goal:** establish the type/schema foundation everything validates against.
No Proxy. No materializer. Just the kinded IR schemas, `valueOrRef` unions,
and migration of CSS schemas from regex strings to object-ref form.

### Scope (TDD, one behavior at a time)

1. **Kinded `FlatNode` discriminated union in `html.schemas.ts`** — types for
   all 11 kinds. Each has a `kind` literal discriminator:
   - `element` — `{ kind: 'element', tag: string, attrs, children, etc. }`
   - `$class` — `{ kind: '$class', name: string, rules: Record<string, unknown> }`
   - `$host` — `{ kind: '$host', rules: Record<string, unknown> }`
   - `$root` — `{ kind: '$root', declarations: Record<string, unknown> }`
   - `$top` — `{ kind: '$top', atRule: string, rules: Record<string, unknown> }`
   - `$keyframe` — `{ kind: '$keyframe', ident: string, frames: ... }`
   - `$token` — `{ kind: '$token', path: string }`
   - `$style` — `{ kind: '$style', path: string }`
   - `$template` — `{ kind: '$template', path: string }`
   - `$switch` — `{ kind: '$switch', path: string, cases: Record<string, ...>, default?: ... }`
   - `$path` — `{ kind: '$path', path: string }`

2. **`valueOrRef` helper** — reusable `z.union([z.string(), z.number(), z.boolean(), pathRefSchema])`
   spread into every attribute schema field. Follows the same union pattern
   already used in `css.schemas.ts`.

3. **CSS schemas: regex → object-ref** — update `css.schemas.ts` (and the
   generator in `scripts/generate-css-schemas.spec.ts` + `src/cli/css-schemas.ts`)
   to emit:
   ```ts
   const tokenRefSchema = z.object({ $token: z.string() })
   const keyframeRefSchema = z.object({ $keyframe: z.string() })
   const pathRefSchema = z.object({ $path: z.string() })
   ```
   Every CSS property becomes `z.union([value, tokenRef, pathRef])`. Remove
   imports of `TOKEN_REF_PATTERN`/`KEYFRAME_REF_PATTERN` from `css.schemas.ts`.

4. **`valueOrRef` in Plaited attributes too** — `p-trigger`, `p-target`,
   `p-scale`, `p-form`, `style`, `class` — all Plaited-specific attributes
   also need the union so `$path` can appear anywhere.

5. **JSON Pointer helper** — `resolvePointer(data, pointer)` in `src/client/`.
   RFC 6901 semantics (`/`, `/0`, `/a/b`, `~1`/`~0` escaping). Pure function;
   reuse from stdlib if available (check first — Minimal-Implementation step 3).

6. **Delete `resolve-template-refs.ts`** — already done in the repo. Ensure
   no remaining imports or re-exports.

### Verify before commit
- `bun --bun tsc --noEmit` clean for touched files.
- `bun test` for the new schema specs.
- `scripts/generate-css-schemas.spec.ts` updated and passing (this commit
  changes the emitted CSS schema shape).
- **Commit message:** `feat(client): kinded FlatNode IR schemas + CSS ref migration to object-ref form`

---

## Commit 2 — Authoring surface: `ui` Proxy

**Goal:** the `ui` Proxy in `src/client/ui.ts` — the metaprogramming DSL that
produces the FlatNode JSON agents send to the `Renderer`. Builds on Commit 1's
types. No resolution yet — the Proxy produces IR, it doesn't execute it.

### Scope (TDD, one behavior at a time)

1. **Read MDN docs on Proxy and Reflect** (`mdn-web-docs` skill) before
   writing the Proxy handler.

2. **`ui` Proxy in `src/client/ui.ts`** — single `get` trap. All methods are
   `$`-prefixed. The `get` trap checks `prop.startsWith('$')`:
   - `ui.$element(tag, opts)` → `{ kind: 'element', tag, ... }`
   - `ui.$class(name, rules)` → `{ kind: '$class', name, rules }`
   - `ui.$host(rules)` → `{ kind: '$host', rules }`
   - `ui.$root(declarations)` → `{ kind: '$root', declarations }`
   - `ui.$top(atRule, rules)` → `{ kind: '$top', atRule, rules }`
   - `ui.$keyframe(ident, frames)` → `{ kind: '$keyframe', ident, frames }`
   - `ui.$token(path)` → `{ kind: '$token', path }`
   - `ui.$style(path)` → `{ kind: '$style', path }`
   - `ui.$template(path)` → `{ kind: '$template', path }`
   - `ui.$switch(path, cases, default?)` → `{ kind: '$switch', path, cases, default }`
   - `ui.$path(pointer)` → `{ kind: '$path', path: pointer }`
   - Each method returns a FlatNode immediately. No chaining, no terminal.

   Reuse `createStyles`/`createKeyframes` logic from `css.ts` as method bodies
   for `$class`/`$host`/`$root`/`$top`/`$keyframe` (extract, don't rewrite).

3. **Migrate `ssr.ts`** — replace its one `h('script', ...)` callsite with
   `ui.$element('script', { src, type: 'module', async: true })`. `ssr()`'s
   join + `<style>` inject + `:host`→`:root` logic stays.

4. **Delete `h()` / `fragment` / `$`-helpers** from `template.ts` once nothing
   imports them.

5. **Delete the ingestion parser** if it exists — markers and regex patterns
   have no place in the end state.

### Verify before commit
- `bun --bun tsc --noEmit` clean.
- New `ui` Proxy spec: each method emits the correct kinded node shape.
- `ssr.ts` migration: existing `ssr` snapshots/tests still pass.
- No remaining imports of `h()`, `fragment`, `$`-helpers.
- **Commit message:** `feat(client): ui Proxy — single $prefixed kinded-node authoring surface, drop h()`

---

## Commit 3 — `Renderer` in `renderer.ts`

**Goal:** flesh out the `Renderer` class already stubbed in `src/client/renderer.ts`.
One-pass JIT walk over FlatNode[] → `TemplateObject`. JIT resolution surfaces
errors at the point of failure.

### Scope (TDD, one behavior at a time)

1. **`Renderer` constructor** — takes `{ pathResolver, catalogs }`. Stores
   them as private fields. The class accumulates state in `#tpl` during walk.

2. **`getTemplateObject(nodes: FlatNode[]): TemplateObject`** — the public
   entry point. Resets internal state, walks nodes in order, dispatches by
   `kind` to the appropriate private method.

3. **Private methods — one per kind:**
   - **`#element(node)`** — serialize tag, attrs (with `htmlEscape`,
     `BOOLEAN_ATTRS`, `VOID_TAGS`, `on*` rejection, script policy,
     `p-trigger` serialization, `p-scale` enforcement), children, shadow DOM
     inline styles. All the logic from `template.ts`'s `h()` carries over.
   - **`#class(node)` / `#host(node)` / `#root(node)` / `#top(node)` /
     `#keyframe(node)`** — resolve `$token`/`$path` refs in their rules
     immediately, emit hashed descriptors + stylesheet entries.
   - **`#token(node)`** — resolve against token catalog, inline `var()`.
   - **`#style(node)`** — resolve against style catalog, accumulate
     classNames + stylesheets.
   - **`#template(node)`** — fetch child nodes from template catalog by path,
     dispatch each in current scope.
   - **`#switch(node)`** — `await pathResolver(switch.path, scope)`, select
     case, dispatch child nodes.
   - **`#path(node)`** — `await pathResolver(path, scope)`, return resolved
     value.

4. **Scope narrowing** — when `#template` fetches child nodes, push the
   current path segment onto the scope stack. Inside a per-item template,
   `$path` refs auto-narrow: `/items/0` scope makes `/name` resolve as
   `/items/0/name`.

5. **Concurrency** — fan out independent subtrees (`Promise.all` over
   siblings). A page with 20 `$path` fetches should take ~1× not 20×.

6. **Error policy** — callback throws → `getTemplateObject` rejects. No
   try/catch in the walker. Let errors propagate so the agent gets a precise
   failure signal at the offending node.

7. **`static ssr(tpl: TemplateObject): string`** — already stubbed. Converts
   a `TemplateObject` into a full HTML page string. Inlines stylesheets into
   `<style>`, replaces `:host` → `:root` for SSR.

### Verify before commit
- `bun --bun tsc --noEmit` clean.
- `Renderer` spec: each kind resolves correctly; escaping, boolean attrs,
  void tags, script policy all preserved from old `template.ts` behavior.
- Scope narrowing works in multi-level templates.
- Concurrency fans out (verify with a test that asserts `Promise.all` behavior).
- Throwing callbacks reject the whole render.
- `Renderer.ssr()` produces correct full-page HTML.
- E2E test: FlatNodes with nested `$path`+`$template` → `getTemplateObject`
  with stub `pathResolver` → `Renderer.ssr` → snapshot assertion.
- **Commit message:** `feat(client): Renderer — JIT one-pass materializer over kinded FlatNodes`

---

**See [AGENTS.md](AGENTS.md) §Core Conventions — Minimal-Implementation Directive** — the
full directive lives there now; this task obeys it.