/** attribute used to manipulate a dom element */
export const dataTarget = 'data-target'
/** attribute used to wire a dom element to the component event listener */
export const dataTrigger = 'data-trigger'
/** attribute used to wire a dom element to a useMessenger exchange */
export const dataAddress = 'data-address'
/** void attributes */
export const voidTags = new Set([
  'area',
  'base',
  'basefont',
  'bgsound',
  'br',
  'col',
  'command',
  'embed',
  'frame',
  'hr',
  'img',
  'isindex',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'nextid',
  'param',
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
/** boolean attributes */
export const booleanAttrs = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
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
  'readonly',
  'required',
  'reversed',
  'selected',
])

export const primitives = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])

export const validPrimitiveChildren = new Set(['number', 'string', 'bigint'])

export const templateKeys = ['content', 'stylesheets', 'string']