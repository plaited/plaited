export const CHILDREN = 'children'

export const STYLE = 'style'

export const STYLES = 'styles'

export const CLASS = 'class'

/**
 * Pattern for lowercase custom element tags after template tag normalization.
 * Must contain a hyphen (per the custom elements spec) — e.g. `my-widget`, `x-app-root`.
 * @public
 */
export const CUSTOM_ELEMENT_TAG_PATTERN = /^[a-z][.0-9_a-z-]*-[.0-9_a-z-]*$/

/**
 * A Set containing HTML and SVG tag names that are considered "void elements".
 * Void elements cannot have any content (neither HTML nor text nodes) and are
 * represented with a self-closing tag in HTML serialization (e.g., `<br />`, `<img src="..." />`).
 * This set is used during template creation to determine if a closing tag is needed.
 */
export const VOID_TAGS = new Set([
  // HTML void elements per HTML5 spec.
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'menuitem',
  'meta',
  'source',
  'track',
  'wbr',
  // SVG elements treated as self-closing during serialization.
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'stop',
  'use',
])

/**
 * A Set containing strings representing JavaScript primitive type names, obtained via `typeof` or `trueTypeOf`.
 * This is used internally during template creation to validate the types of values assigned to element attributes.
 * Attributes generally must have primitive values unless handled specifically (like `style`, `p-trigger`, etc.).
 */
export const PRIMITIVES = new Set([
  // Primitive types that can be attribute values.
  'null',
  'undefined',
  'number',
  'string',
  'boolean',
])
/**
 * A Set containing strings representing JavaScript primitive type names that are considered valid
 * and directly renderable as child content within an element (e.g., inside `<div>...</div>`).
 * Currently, only 'number' and 'string' are allowed; other primitives like `boolean`, `null`, `undefined` are ignored when used as children.
 */
export const VALID_PRIMITIVE_CHILDREN = new Set([
  // Only string and number can be rendered as text content.
  'number',
  'string',
])

export const PLAITED_TEMPLATE_IDENTIFIER = '🧩' as const
