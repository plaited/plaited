/**
 * Attribute identifier for DOM element manipulation targets.
 * Used to mark elements that will be programmatically modified.
 */
export const P_TARGET = 'p-target'
/**
 * Attribute identifier for event delegation and handling.
 * Used to connect DOM elements to component event listeners.
 */
export const P_TRIGGER = 'p-trigger'
/**
 * Set of HTML and SVG void elements that cannot have children.
 * These elements must be self-closing in HTML syntax.
 * Includes both HTML elements (e.g., 'br', 'img') and SVG elements (e.g., 'path', 'rect').
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
 * Set of HTML boolean attributes that don't require values.
 * These attributes' presence indicates true, absence indicates false.
 * Includes standard HTML attributes and Electron-specific attributes.
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
 * Set of JavaScript primitive types valid for attribute values.
 * Used for attribute value type validation during template creation.
 */
export const PRIMITIVES = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])
/**
 * Set of JavaScript primitive types that can be safely used as child content.
 * Defines which primitive values can be rendered as element children.
 */
export const VALID_PRIMITIVE_CHILDREN = new Set(['number', 'string', 'bigint'])
/**
 * Unique identifier for template objects.
 * Used to distinguish template objects from other values during rendering.
 */
export const TEMPLATE_OBJECT_IDENTIFIER = '🦄'
