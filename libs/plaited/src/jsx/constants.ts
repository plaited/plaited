import { VoidTags, BooleanAttributes } from '../types.js'
/** attribute used to manipulate a dom element */
export const bpTarget = 'bp-target'
/** attribute used to wire a dom element to the component event listener */
export const bpTrigger = 'bp-trigger'
/** attribute used to wire a dom element to a useMessenger exchange */
export const bpAddress = 'bp-address'
/** void attributes */
export const voidTags = new Set<keyof VoidTags>([
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
