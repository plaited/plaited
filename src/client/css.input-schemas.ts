// @ts-nocheck - recursive z.lazy types require explicit annotation in Zod 4
/**
 * @module css.input-schemas
 *
 * Catalog-input Zod schemas describing the raw agent JSON shapes for
 * tokens, keyframes, and styles. These describe the *serialized* form
 * that flows from the DB/JSONL layer into the materializers.
 *
 * @remarks
 * - The agent emits literal CSS values only (no $refs). $tokenRef/$keyframeRef
 *   will be handled by a future resolver layer (§3.5) and are OUT OF SCOPE.
 * - $styleRef and $bind are not defined here (component/HTML schema).
 * - The Catalog* prefix distinguishes agent-JSON schemas from in-memory
 *   output types in css.types.ts (which are callables / generics).
 * - No superRefine for core shape — structural schemas only.
 */

import { z } from 'zod'

// --- Primitive helpers ---

/**
 * Primitive CSS/property value: string or number.
 */
export const CssValueSchema = z.union([z.string(), z.number()])
export type CssValue = z.output<typeof CssValueSchema>

// --- Nested statements (agent JSON shape) ---

/**
 * Recursive schema for nested CSS statements within a property value.
 *
 * Keys are restricted to the structural set the runtime understands:
 * - `$default` → the default value for this property
 * - `$compoundSelectors` → flat map of selector→value (valid only inside `$host`)
 * - `@…`       → at-rules (media, container, supports, etc.)
 * - `:…`       → pseudo-classes (:hover, :focus, etc.)
 * - `[…]`      → attribute selectors ([disabled], [data-x="y"])
 *
 * All terminal values are literals (string | number) — no $refs.
 */
export const CatalogNestedStatementsSchema = z.lazy(
  (): z.ZodTypeAny =>
    z
      .object({
        $default: CssValueSchema.optional(),
        $compoundSelectors: z.record(z.string(), z.union([CssValueSchema, CatalogNestedStatementsSchema])).optional(),
      })
      .catchall(z.union([CssValueSchema, CatalogNestedStatementsSchema])),
)
export type CatalogNestedStatements = z.output<typeof CatalogNestedStatementsSchema>

// --- Per-property rules (agent JSON shape) ---

/**
 * CSS rules for a single element entry.
 * Keys are property names; values are literal values or nested statements (no refs).
 */
export const CatalogCSSRulesSchema = z.lazy(() =>
  z.record(z.string(), z.union([CssValueSchema, CatalogNestedStatementsSchema])),
)
export type CatalogCSSRules = z.output<typeof CatalogCSSRulesSchema>

/**
 * CreateParams schema — the raw agent JSON shape for style definitions.
 * Top-level keys are logical style names; values are CSSRules.
 */
export const CatalogCreateParamsSchema = z.record(z.string(), CatalogCSSRulesSchema)
export type CatalogCreateParams = z.output<typeof CatalogCreateParamsSchema>

// --- Design tokens (agent JSON shape) ---

/**
 * Function token value — e.g., `calc()`, `rgb()`, `clamp()`.
 * Arguments are literals only — no $refs.
 */
export const CatalogFunctionTokenValueSchema = z.union([
  z.object({
    $function: z.string(),
    $arguments: CssValueSchema,
  }),
  z.object({
    $function: z.string(),
    $arguments: z.array(CssValueSchema),
    $csv: z.boolean(),
  }),
])
export type CatalogFunctionTokenValue = z.output<typeof CatalogFunctionTokenValueSchema>

/**
 * Design token value — primitive or function-based.
 */
export const CatalogDesignTokenValueSchema = z.union([CssValueSchema, CatalogFunctionTokenValueSchema])
export type CatalogDesignTokenValue = z.output<typeof CatalogDesignTokenValueSchema>

/**
 * Design token — single value or CSV array.
 */
export const CatalogDesignTokenSchema = z.union([
  z.object({
    $value: CatalogDesignTokenValueSchema,
  }),
  z.object({
    $value: z.array(CatalogDesignTokenValueSchema),
    $csv: z.boolean(),
  }),
])
export type CatalogDesignToken = z.output<typeof CatalogDesignTokenSchema>

/**
 * Design token scale — one level of nesting.
 */
export const CatalogDesignTokenScaleSchema = z.record(z.string(), CatalogDesignTokenSchema)
export type CatalogDesignTokenScale = z.output<typeof CatalogDesignTokenScaleSchema>

/**
 * Design token group — tokens or nested scales.
 */
export const CatalogDesignTokenGroupSchema = z.record(
  z.string(),
  z.union([CatalogDesignTokenSchema, CatalogDesignTokenScaleSchema]),
)
export type CatalogDesignTokenGroup = z.output<typeof CatalogDesignTokenGroupSchema>

// --- Keyframes (agent JSON shape) ---

/**
 * Keyframe rule — from/to/percentage keys mapping CSS properties to literal values.
 */
export const CatalogCSSKeyFramesSchema = z.lazy(() =>
  z
    .object({
      from: z.record(z.string(), CssValueSchema).optional(),
      to: z.record(z.string(), CssValueSchema).optional(),
    })
    .catchall(z.record(z.string(), CssValueSchema)),
)
export type CatalogCSSKeyFrames = z.output<typeof CatalogCSSKeyFramesSchema>
