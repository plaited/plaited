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
 * - TEMPLATE_OBJECT_IDENTIFIER uses emoji for uniqueness
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

/**
 * Matches site-root JavaScript module paths accepted by bootstrap script tags
 * and controller module imports.
 *
 * @public
 */
export const SITE_ROOT_JAVASCRIPT_PATH_PATTERN = /^\/(?!\/)[^\s\\?#]+\.js(?:[?#][^\s\\]*)?$/

/** Pattern for lowercase custom element tags after template tag normalization. */
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
/**
 * A unique string constant used as an identifier (`$`) property on Plaited's internal `TemplateObject`.
 * This allows reliably distinguishing Plaited template objects from plain JavaScript objects during
 * the processing of children in `h` and `fragment`.
 *
 * @remarks
 * The emoji value is chosen for console readability and low collision risk.
 */
export const TEMPLATE_OBJECT_IDENTIFIER = '🦄'

export const CONNECT_PLAITED_ROUTE = '/.plaited/connect.js'

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

export const FLOW_CONTROL_HELPERS = keyMirror('val', 'for', 'switch', 'case', 'default', 'with', 'slot')
