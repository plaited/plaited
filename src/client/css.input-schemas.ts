/**
 * @module css.input-schemas
 *
 * Catalog-input Zod schemas describing the raw agent JSON shapes for
 * tokens, keyframes, and styles. These describe the *serialized* form
 * that flows from the DB/JSONL layer into the ref resolver.
 *
 * @remarks
 * - No cross-catalog id existence checks (resolver's job).
 * - $styleRef and $bind are not defined here (component/HTML schema).
 * - $keyframeRef is position-constrained to animation/animation-name
 *   value schemas via codegen, not superRefine.
 * - No superRefine for core shape — structural schemas only.
 */

import { z } from 'zod'

// --- Primitive helpers ---

/**
 * Primitive token value: string or number.
 */
export const PrimitiveTokenValueSchema = z.union([z.string(), z.number()])

// --- CSS value variants ---

/**
 * A `$tokenRef` reference — resolves to a design token's `var(--…)`.
 */
export const TokenRefSchema = z.object({
  $tokenRef: z.string(),
})

/**
 * A `$keyframeRef` reference — resolves to a hashed keyframe id.
 * Legal ONLY in `animation` / `animation-name` value schemas
 * (enforced structurally via codegen, not superRefine).
 */
export const KeyframeRefSchema = z.object({
  $keyframeRef: z.string(),
})

/**
 * Css value: literal value, token reference, or keyframe reference.
 */
export const CssValueSchema = z.union([z.union([z.string(), z.number()]), TokenRefSchema, KeyframeRefSchema])

// --- Nested statements ---

/**
 * Recursive schema for nested CSS statements within a property value.
 * Supports `$default`, `$compoundSelectors`, `@…` at-rules, `:…` pseudo-classes,
 * `[…]` attribute selectors — each nesting another NestedStatements or a CssValue.
 *
 * This is hand-written (template-literal keys codegen poorly).
 */
export const NestedStatementsSchema = z.lazy(() =>
  z
    .object({
      $default: CssValueSchema.optional(),
      $compoundSelectors: z.record(z.union([CssValueSchema, NestedStatementsSchema])).optional(),
    })
    .catchall(z.union([CssValueSchema, NestedStatementsSchema])),
)

// --- Per-property rules ---

/**
 * CSS rules for a single element entry.
 * Keys are property names; values are value, nested statements, or token refs.
 */
export const CSSRulesSchema = z.lazy(() => z.record(z.union([CssValueSchema, NestedStatementsSchema])))

/**
 * CreateParams schema — the raw agent JSON shape for style definitions.
 * Top-level keys are logical style names; values are CSSRules.
 * Special keys `$host`, `$root`, `$top` select scoping at the createStyles level.
 */
export const CreateParamsSchema = z.record(z.string(), CSSRulesSchema)

// --- Design tokens ---

/**
 * Function arguments — primitive values or token references.
 */
const FunctionTokenArgumentsSchema = z.union([PrimitiveTokenValueSchema, TokenRefSchema])

/**
 * Function token value — e.g., `calc()`, `rgb()`, `clamp()`.
 */
export const FunctionTokenValueSchema = z.union([
  z.object({
    $function: z.string(),
    $arguments: FunctionTokenArgumentsSchema,
  }),
  z.object({
    $function: z.string(),
    $arguments: z.array(FunctionTokenArgumentsSchema),
    $csv: z.boolean(),
  }),
])

/**
 * Design token value — primitive, function, or token reference.
 */
export const DesignTokenValueSchema = z.union([PrimitiveTokenValueSchema, FunctionTokenValueSchema, TokenRefSchema])

/**
 * Design token — single value or CSV array.
 */
export const DesignTokenSchema = z.union([
  z.object({
    $value: DesignTokenValueSchema,
  }),
  z.object({
    $value: z.array(DesignTokenValueSchema),
    $csv: z.boolean(),
  }),
])

/**
 * Design token scale — one level of nesting.
 */
export const DesignTokenScaleSchema = z.record(z.string(), DesignTokenSchema)

/**
 * Design token group — tokens or nested scales.
 */
export const DesignTokenGroupSchema = z.record(z.string(), z.union([DesignTokenSchema, DesignTokenScaleSchema]))

// --- Keyframes ---

/**
 * Keyframe rule — from/to/percentage keys mapping CSS properties to values.
 */
export const CSSKeyFramesSchema = z.lazy(() =>
  z
    .object({
      from: z.record(z.string(), CssValueSchema).optional(),
      to: z.record(z.string(), CssValueSchema).optional(),
    })
    .catchall(z.record(z.string(), CssValueSchema)),
)
