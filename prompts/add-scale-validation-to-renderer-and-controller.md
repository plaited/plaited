# Prompt: Add `p-scale` nesting validation to Renderer and Controller

> **Status: Superseded.** This prompt proposed runtime *enforcement* of
> `p-scale` nesting + a "scale-as-data" channel for MCP Apps. The decision
> (2026-08) took a different path: `p-scale` is **advisory structural
> metadata**, not enforced at runtime. The implemented `scaleCheck` operation
> (Renderer method + Controller `scale_check` WS message) is a read-only
> pre-flight that returns the effective structural boundary, so the agent can
> generate content that respects it *before* rendering. No `scale-as-data`
> field was added to `RenderMessage` — MCP Apps / A2UI host composition is
> out of scope. See `design-spec.md` → Structural scale for the current
> mechanism.

## Goal

Add structural-scale (`p-scale`) nesting validation to the Renderer (SSR) and Controller (browser CSR), mirroring the constraint that used to live in the old `src/client/template.ts` (commit `425dcab`). The validation must also **pass scale in data, not just HTML**, so the same structural intent flows to the MCP App host pattern (A2UI-in-MCP-apps) where the payload is JSON, not an HTML attribute the host renders.

## Background

The design spec locks `p-scale` (S1–S6 + `rel`) with a nesting constraint: **a higher structural scale cannot nest inside a lower structural boundary container.** `SCALE_RANK` ranks `rel`=0, `s1`=1 … `s6`=6. The old template.ts threw `ScaleViolantionError` (`name = 'scale_violation'`) when a child's scale rank exceeded its container's.

The Renderer and Controller currently apply `render`/`attrs` commands with no structural-scale check — the validation was lost when template.ts was removed. We need it back, but adapted to two realities:

1. **The Renderer uses `HTMLRewriter`** (Bun SSR, string in/out); the Controller uses `querySelectorAll` + `setHTMLUnsafe` (live DOM). Both need the same check, so factor a shared helper.
2. **For MCP Apps** (the A2UI-in-MCP-apps pattern), the rendered surface is served as a resource whose structural intent should be carried as **data** (the scale of rendered content) alongside the HTML — so a host that doesn't render `p-scale` attributes still knows the structural boundary. This means `render` should be able to carry an optional `scale` in the message detail, and the Renderer/Controller should validate the nesting using that declared scale when present, falling back to reading the `p-scale` attribute of the matched target element when absent.

## Reference: the old validation

From `src/client/template.ts` @ `425dcab14259fd179d6a7af783310e4fb5a53a8a`:

```ts
// h() — when processing children, for each child TemplateObject whose scale !== rel:
if (pScale === SCALE.rel) {
  // rel container accepts anything; track highest child scale
  if (SCALE_RANK[scale] > SCALE_RANK[highestChildScale]) highestChildScale = scale
} else {
  // non-rel container: child scale rank must not exceed container's
  if (SCALE_RANK[scale] > SCALE_RANK[pScale]) {
    throw new ScaleViolantionError(
      `Cannot nest higher structural order element (${scale}) inside a lower structural boundary container (${pScale}) at tag <${tag}>.`,
    )
  }
}
```

- `SCALE = keyMirror('s1','s2','s3','s4','s5','s6','rel')`
- `SCALE_RANK = { s1:1, s2:2, s3:3, s4:4, s5:5, s6:6, rel:0 }`
- Error class: `class ScaleViolantionError extends Error { override name = 'scale_violation' }`

## Scope

### Files to change

- `packages/framework/src/main/renderer.ts` — add scale validation to `render()`
- `packages/framework/src/controller/controller.ts` — add scale validation to `#render()`
- New shared helper, e.g. `packages/framework/src/main/scale-validation.ts` (reusable by both)
- `packages/framework/src/main/html.constants.ts` — already exports `SCALE`, `SCALE_RANK`, `P_SCALE` (reuse)
- `packages/framework/src/main/message.schemas.ts` — add optional `scale` to `RenderMessageSchema` detail
- `packages/framework/src/main/render.errors.ts` — add `ScaleViolationError` (rename the old `ScaleViolantionError` typo → `ScaleViolationError`, `name = 'scale_violation'`)
- Tests: `packages/framework/src/main/tests/renderer.spec.ts` and `packages/framework/src/controller/tests/` — add nesting-valid and nesting-violation cases

### Reusable helper

Create a function like:

```ts
// packages/framework/src/main/scale-validation.ts
import { SCALE, SCALE_RANK } from './html.constants.ts'

export class ScaleViolationError extends Error {
  override name = 'scale_violation'
  constructor(
    containerScale: string,
    contentScale: string,
    context: string,
  ) {
    super(
      `Cannot nest higher structural order element (${contentScale}) inside a lower structural boundary container (${containerScale}) ${context}.`,
    )
  }
}

/**
 * Validate that content of declared scale may nest inside a container of
 * declared scale. `rel` containers accept any content; non-rel containers
 * reject content whose rank exceeds theirs. Unknown scales are ignored
 * (treated as `rel`) — only validated, declared scales enforce.
 *
 * @internal
 */
export const assertScaleNesting = (
  containerScale: string | undefined,
  contentScale: string | undefined,
  context: string,
): void => {
  if (!containerScale || !contentScale) return
  if (!(containerScale in SCALE_RANK) || !(contentScale in SCALE_RANK)) return
  if (containerScale === SCALE.rel) return
  if (SCALE_RANK[contentScale as keyof typeof SCALE_RANK] > SCALE_RANK[containerScale as keyof typeof SCALE_RANK]) {
    throw new ScaleViolationError(containerScale, contentScale, context)
  }
}
```

### Renderer integration

In `Renderer.render()`:

1. Read the matched target element's existing `p-scale` attribute (the container scale). With `HTMLRewriter`, you can read attributes inside the `element` handler (`element.getAttribute(P_SCALE)`).
2. Determine the content scale: prefer an optional `scale` field on `RenderMessage['detail']` (see schema change); otherwise leave undefined (no content-scale assertion → no enforcement, preserving current behavior when the field is absent).
3. Call `assertScaleNesting(containerScale, contentScale, \`at target [${target}]\`)` inside the element handler before `applySwap`.
4. Re-throw the `ScaleViolationError` so the behavioral engine's `feedback_error` captures it (same path as `ValidationError`).

### Controller integration

In `#render()`:

1. For each matched element, read `element.getAttribute(P_SCALE)` (container scale).
2. Use the optional `scale` from the message detail as content scale.
3. Call `assertScaleNesting(containerScale, contentScale, \`at target [${target}]\`)` before `#performSwap`.
4. Let the `ScaleViolationError` propagate (the Controller's error path already forwards named errors to the agent runtime).

### Message schema change

Add an optional `scale` to `RenderMessageSchema.detail`:

```ts
import { SCALE } from './html.constants.ts'
// ...
export const RenderMessageSchema = z.object({
  type: z.literal(CONTROLLER_INCOMING_MESSAGE_TYPES.render),
  detail: z.object({
    id: z.string(),
    target: z.string(),
    html: z.string(),
    // Optional declared structural scale of the rendered content. When
    // present, the Renderer/Controller validate it against the matched
    // target's p-scale (nesting constraint). Also flows as data to MCP App
    // hosts that consume the render result as a structured resource.
    scale: z.enum([SCALE.s1, SCALE.s2, SCALE.s3, SCALE.s4, SCALE.s5, SCALE.s6, SCALE.rel]).optional(),
    match: SelectorMatchScehama.optional(),
    swap: z.enum([...]),
  }),
})
```

### Why "scale in data" matters for MCP Apps

The A2UI-in-MCP-apps pattern serves rendered content as `application/a2ui+json` (or a plaited BPEvent resource) consumed by a host's renderer. The host may not render the `p-scale` attribute at all — its components are A2UI components, not plaited `[p-target]` elements. By carrying `scale` in the message detail (data), the structural intent travels with the payload regardless of how the host renders it. The reference plaited client uses `scale` for the nesting check; an A2UI host can use it to map to its own component hierarchy. This keeps `p-scale` semantics substrate-neutral (per the design spec) while letting the plaited Renderer/Controller enforce the constraint when they're the applier.

## Constraints

- Follow `AGENTS.md` conventions: arrow functions, type over interface, no `any`, `type` only for the error, Bun APIs, `test` not `it`, `describe` blocks.
- Factor the check into one reusable helper used by both Renderer and Controller (avoid duplication — this is a real shared domain rule, not a one-off).
- Do NOT remove the fallback: when `scale` is absent from the message detail, behavior is unchanged (no enforcement). Enforcement is opt-in via the optional field. This keeps existing handlers working.
- Add tests for: (a) valid nesting passes (s3 inside s5), (b) `rel` container accepts any content, (c) violation throws `ScaleViolationError` with `name === 'scale_violation'`, (d) absent `scale` → no enforcement (current behavior preserved).
- Run `bun --bun tsc --noEmit` and the targeted tests (`renderer.spec.ts`, controller render tests) before finishing.

## Out of scope

- MCP-server emission of the `scale` field (that's the research/mcp-apps doc, not this change).
- A2UI JSON mapping (separate effort).
- Changing `attrs()` — attrs don't introduce new structural content, so the nesting check applies only to `render()`.
