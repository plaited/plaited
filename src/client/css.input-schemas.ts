// @ts-nocheck - recursive z.lazy types require explicit annotation in Zod 4
/**
 * @module css.input-schemas
 *
 * Catalog-input Zod schemas describing the raw agent JSON shapes for
 * tokens, keyframes, and styles. These describe the *serialized* form
 * that flows from the DB/JSONL layer into the materializers.
 *
 * @remarks
 * - $tokenRef and $keyframeRef are the vocabulary of the catalog (JSONL, §3.4).
 *   The utils resolve them inline given a registry (not a separate resolver layer).
 * - $styleRef and $bind are not defined here (component/HTML schema).
 * - The Catalog* prefix distinguishes agent-JSON schemas from in-memory
 *   output types in css.types.ts (which are callables / generics).
 * - No superRefine for core shape — structural schemas only.
 * - $keyframeRef position constraint is enforced inline in createStyles and
 *   createKeyframes (branch on prop name when a {$keyframeRef} is encountered).
 */

import { z } from 'zod'

// --- Primitive helpers ---

/**
 * Primitive CSS/property value: string or number.
 */
export const PrimitiveValueSchema = z.union([z.string(), z.number()])
export type PrimitiveValue = z.output<typeof PrimitiveValueSchema>

// --- $ref schemas ---

/**
 * A `$tokenRef` reference — resolves to a design token's `var(--…)`.
 * Legal in every CSS property value and in design token aliases.
 */
export const TokenRefSchema = z.object({
  $tokenRef: z.string(),
})
export type TokenRef = z.output<typeof TokenRefSchema>

/**
 * A `$keyframeRef` reference — resolves to a hashed keyframe id.
 * Legal ONLY in animation / animation-name value schemas
 * (enforced inline in createStyles/createKeyframes, not superRefine).
 */
export const KeyframeRefSchema = z.object({
  $keyframeRef: z.string(),
})
export type KeyframeRef = z.output<typeof KeyframeRefSchema>

/**
 * Catalog value union: literal ∪ $tokenRef ∪ $keyframeRef.
 */
export const CatalogCssValueSchema = z.union([PrimitiveValueSchema, TokenRefSchema, KeyframeRefSchema])
export type CatalogCssValue = z.output<typeof CatalogCssValueSchema>

// --- Nested statements (catalog JSON shape) ---

/**
 * Recursive schema for nested CSS statements within a property value.
 * Terminal values are the catalog value union (literal or $ref).
 */
export const CatalogNestedStatementsSchema = z.lazy(
  (): z.ZodTypeAny =>
    z
      .object({
        $default: CatalogCssValueSchema.optional(),
        $compoundSelectors: z
          .record(z.string(), z.union([CatalogCssValueSchema, CatalogNestedStatementsSchema]))
          .optional(),
      })
      .catchall(z.union([CatalogCssValueSchema, CatalogNestedStatementsSchema])),
)
export type CatalogNestedStatements = z.output<typeof CatalogNestedStatementsSchema>

// --- Per-property rules (catalog JSON shape) ---

export const CatalogCSSRulesSchema = z.lazy(() =>
  z.record(z.string(), z.union([CatalogCssValueSchema, CatalogNestedStatementsSchema])),
)
export type CatalogCSSRules = z.output<typeof CatalogCSSRulesSchema>

/**
 * CreateParams schema — the raw catalog JSON shape for style definitions.
 */
export const CatalogCreateParamsSchema = z.record(z.string(), CatalogCSSRulesSchema)
export type CatalogCreateParams = z.output<typeof CatalogCreateParamsSchema>

// --- Design tokens (catalog JSON shape) ---

/**
 * Function arguments — literals or $tokenRef.
 */
const CatalogFunctionTokenArgumentsSchema = z.union([PrimitiveValueSchema, TokenRefSchema])

/**
 * Function token value — e.g., `calc()`, `rgb()`, `clamp()`.
 */
export const CatalogFunctionTokenValueSchema = z.union([
  z.object({
    $function: z.string(),
    $arguments: CatalogFunctionTokenArgumentsSchema,
  }),
  z.object({
    $function: z.string(),
    $arguments: z.array(CatalogFunctionTokenArgumentsSchema),
    $csv: z.boolean(),
  }),
])
export type CatalogFunctionTokenValue = z.output<typeof CatalogFunctionTokenValueSchema>

/**
 * Design token value — primitive, function-based, or $tokenRef.
 */
export const CatalogDesignTokenValueSchema = z.union([
  PrimitiveValueSchema,
  CatalogFunctionTokenValueSchema,
  TokenRefSchema,
])
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

export const CatalogDesignTokenScaleSchema = z.record(z.string(), CatalogDesignTokenSchema)
export type CatalogDesignTokenScale = z.output<typeof CatalogDesignTokenScaleSchema>

export const CatalogDesignTokenGroupSchema = z.record(
  z.string(),
  z.union([CatalogDesignTokenSchema, CatalogDesignTokenScaleSchema]),
)
export type CatalogDesignTokenGroup = z.output<typeof CatalogDesignTokenGroupSchema>

// --- Keyframes (catalog JSON shape) ---

export const CatalogCSSKeyFramesSchema = z.lazy(() =>
  z
    .object({
      from: z.record(z.string(), CatalogCssValueSchema).optional(),
      to: z.record(z.string(), CatalogCssValueSchema).optional(),
    })
    .catchall(z.record(z.string(), CatalogCssValueSchema)),
)
export type CatalogCSSKeyFrames = z.output<typeof CatalogCSSKeyFramesSchema>
