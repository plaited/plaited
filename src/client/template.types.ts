import type { SCALE, TEMPLATE_OBJECT_IDENTIFIER } from './template.constants.ts'
import type {
  PlaitedAttributes as _PlaitedAttributes,
  CustomElementTag,
  DetailedHtmlAttributes,
  DetailedSvgAttributes,
  ElementAttributeList,
} from './template.schemas.ts'

/**
 * Represents the internal structure produced by Plaited's JSX factory (`h`).
 * This object contains the processed HTML strings and associated metadata needed for rendering.
 *
 * @property html - An array of string fragments representing the HTML structure.
 * @property stylesheets - CSS stylesheets collected from this template and its children.
 * @property $ - A unique symbol (`TEMPLATE_OBJECT_IDENTIFIER`) used as a type guard to identify Plaited template objects.
 */
export type TemplateObject = {
  html: string[]
  stylesheets: string[]
  scale: keyof typeof SCALE
  $: typeof TEMPLATE_OBJECT_IDENTIFIER
}

/**
 * Represents the valid primitive types that can be rendered directly as children within hyperscript.
 * This includes numbers (which are converted to strings) and strings. TemplateObjects are also valid children for composition.
 */
export type Child = number | string | TemplateObject
/**
 * Represents the children prop in hyperscript. It can be a single valid child (`Child`) or an array of children.
 */
export type Children = Child[] | Child

// ── Re-exports from template.schemas.ts ────────────────────────────────────
// Schema-derived types are the source of truth for validated attribute shapes.
// The hand-written equivalents have been removed — see template.schemas.ts.

export type { CustomElementTag, DetailedSvgAttributes, ElementAttributeList }

/**
 * Plaited-specific attributes with runtime-compatible `children` type.
 *
 * @public
 */
export type PlaitedAttributes = _PlaitedAttributes & { children?: Children }

/**
 * Detailed HTML attributes with runtime `Record<string, any>` escape hatch.
 * Supports `data-*` and other arbitrary HTML attributes while preserving
 * schema-validated property types.
 *
 * @public
 */
// biome-ignore lint/suspicious/noExplicitAny: Allows custom data-* and other arbitrary HTML attributes
export type DetailedHTMLAttributes = DetailedHtmlAttributes & Record<string, any>
