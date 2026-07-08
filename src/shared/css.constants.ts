import { z } from 'zod'

/**
 * Pattern matching CSS custom property references like `var(--my-prop)`.
 * Inline style strings use these to reference custom properties at runtime.
 *
 * @public
 */
export const CUSTOM_PROPERTY_REF_PATTERN = /var\(\s*--/

/**
 * Zod schema for CSS custom property reference values matching `var(--name)`.
 * These are always valid as CSS property values, even for properties
 * with fixed enum value schemas.
 *
 * @public
 */
export const customPropertyRefSchema = z.string().regex(CUSTOM_PROPERTY_REF_PATTERN)
