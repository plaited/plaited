/**
 * Constant representing the attribute name (`p-target`) used to identify specific elements
 * within a template. This is primarily utilized by client-side logic (e.g., Plaited's web components)
 * to target elements for updates or interactions based on their assigned identifier.
 */
export const P_TARGET = 'p-target'
/**
 * Constant representing the attribute name (`p-trigger`) used for declarative event binding,
 * connecting DOM events to behavioral program actions. The attribute value typically contains
 * space-separated pairs of `event:action` (e.g., "click:doSomething focus:notify").
 */
export const P_TRIGGER = 'p-trigger'
/**
 * A Set containing HTML and SVG tag names that are considered "void elements".
 * Void elements cannot have any content (neither HTML nor text nodes) and are
 * represented with a self-closing tag in HTML serialization (e.g., `<br />`, `<img src="..." />`).
 * This set is used during template creation to determine if a closing tag is needed.
 */
export const VOID_TAGS = new Set([
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
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'disablepictureinpicture',
  'disableremoteplayback',
  'download',
  'formnovalidate',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'popover',
  'readonly',
  'required',
  'reversed',
  'selected',
  'shadowrootdelegatesfocus',
  // Electron attributes
  'nodeintegration',
  'nodeintegrationinsubframes',
  'plugins',
  'disablewebsecurity',
  'allowpopups',
])
/**
 * A Set containing strings representing JavaScript primitive type names, obtained via `typeof` or `trueTypeOf`.
 * This is used internally during template creation to validate the types of values assigned to element attributes.
 * Attributes generally must have primitive values unless handled specifically (like `style`, `p-trigger`, etc.).
 */
export const PRIMITIVES = new Set(['null', 'undefined', 'number', 'string', 'boolean'])
/**
 * A Set containing strings representing JavaScript primitive type names that are considered valid
 * and directly renderable as child content within an element (e.g., inside `<div>...</div>`).
 * Currently, only 'number' and 'string' are allowed; other primitives like `boolean`, `null`, `undefined` are ignored when used as children.
 */
export const VALID_PRIMITIVE_CHILDREN = new Set(['number', 'string'])
/**
 * A unique string constant used as an identifier (`$`) property on Plaited's internal `TemplateObject`.
 * This allows reliably distinguishing Plaited template objects from plain JavaScript objects during
 * the processing of children in `createTemplate` and `Fragment`.
 */
export const TEMPLATE_OBJECT_IDENTIFIER = '🦄'
