import { VoidTags, BooleanAttributes } from '@plaited/component-types'
/** attribute used to manipulate a dom element */
export const bpTarget = 'bp-target'
/** attribute used to wire a dom element to the component event listener */
export const bpTrigger = 'bp-trigger'
/** attribute used to wire a dom element to a useMessenger exchange */
export const bpAddress = 'bp-address'
/** attribute used to determine if a component is stopping propagation of
 * of form submission and link navigation events
 */
export const bpHypermedia = 'bp-hypermedia'
/** void attributes */
export const voidTags = new Set<VoidTags>([
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
/** boolean attributes */
export const booleanAttrs = new Set<BooleanAttributes>([
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
  // Electron attributes
  'nodeintegration',
  'nodeintegrationinsubframes',
  'plugins',
  'disablewebsecurity',
  'allowpopups',
])

export const primitives = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])

export const validPrimitiveChildren = new Set(['number', 'string', 'bigint'])
