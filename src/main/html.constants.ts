/*
 * @internal
 *
 * Central constants for hyperscript runtime, template creation, and DOM serialization.
 * Defines Plaited's special attributes and DOM behavior.
 *
 * @remarks
 * Implementation details:
 * - VOID_TAGS and BOOLEAN_ATTRS align with HTML5 and SVG specs
 * - P_TARGET & P_TRIGGER declare controller update and event wiring
 * - Sets provide O(1) lookup performance for validation
 *
 * Known limitations:
 * - Static lists may become outdated with HTML spec changes
 * - No support for custom elements' boolean attributes
 * - Electron-specific attributes hardcoded
 * - Case-sensitive attribute matching
 */
import { keyMirror } from '../utils.ts'

/**
 * Constant representing the attribute name (`p-target`) used to identify specific elements
 * within a controller island for server-pushed render and attribute updates.
 */
export const P_TARGET = 'p-target'
/**
 * Constant representing the attribute name (`p-trigger`) used for declarative event binding,
 * connecting DOM events to BP events sent by a controller island. Serialized values contain
 * space-separated pairs of `event:action` (e.g., "click:doSomething focus:notify").
 */
export const P_TRIGGER = 'p-trigger'

export const P_SCALE = 'p-scale'

export const P_FORM = 'p-form'

export const CHILDREN = 'children'

export const STYLE = 'style'

export const STYLES = 'styles'

export const CLASS = 'class'

/** Pattern for lowercase custom element tags after template tag normalization. */
export const CUSTOM_ELEMENT_TAG_PATTERN = /^[a-z][.0-9_a-z-]*-[.0-9_a-z-]*$/

/**
 * Pattern for lowercase unknown/non-standard HTML tag names that are not custom elements
 * (i.e., do not contain a hyphen). Matches any lowercase tag name starting with a letter
 * followed by zero or more lowercase letters or digits. These are tags unknown to the HTML
 * spec that are not valid custom elements — the browser treats them as generic inline elements.
 *
 * @example 'mycomponent', 'x-app-root' — would NOT match (has hyphen, belongs to CUSTOM_ELEMENT_TAG_PATTERN)
 * @example 'myapp', 'thing', 'foo123' — would match
 */
export const UNKNOWN_TAG_PATTERN = /^[a-z][a-z0-9]*$/

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
 * A Set containing HTML attribute names that are considered boolean attributes.
 * Their presence on an element implies a `true` value, and their absence implies `false`.
 * The attribute value itself is typically omitted in HTML serialization (e.g., `<input disabled>`).
 * This set includes standard HTML boolean attributes and some specific to environments like Electron (`<webview>`).
 */
export const BOOLEAN_ATTRS = new Set([
  // Media and content loading attributes.
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'controls',
  'default',
  'defer',
  'disablepictureinpicture',
  'disableremoteplayback',
  'download',
  'loop',
  'muted',
  'nomodule',
  'playsinline',
  // Form and input state attributes.
  'checked',
  'disabled',
  'formnovalidate',
  'multiple',
  'novalidate',
  'readonly',
  'required',
  'reversed',
  'selected',
  // Accessibility and semantic attributes.
  'inert',
  'ismap',
  'itemscope',
  'open',
  'popover',
  'shadowrootdelegatesfocus',
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

export const SCALE = keyMirror('s1', 's2', 's3', 's4', 's5', 's6', 'rel')

export const SCALE_RANK = {
  [SCALE.s1]: 1,
  [SCALE.s2]: 2,
  [SCALE.s3]: 3,
  [SCALE.s4]: 4,
  [SCALE.s5]: 5,
  [SCALE.s6]: 6,
  [SCALE.rel]: 0,
} as const

export const PLAITED_TEMPLATE_IDENTIFIER = '🧩' as const
