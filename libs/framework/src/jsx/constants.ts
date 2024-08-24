import { VoidTags, BooleanAttributes } from './types.js'
/** attribute used to manipulate a dom element */
export const P_TARGET = 'p-target' as const
/** attribute used to wire a dom element to the component event listener */
export const P_TRIGGER = 'p-trigger' as const
/** void attributes */
export const VOID_TAGS = new Set<keyof VoidTags>([
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
export const BOOLEAN_ATTRS = new Set<BooleanAttributes>([
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

export const PRIMITIVES = new Set(['null', 'undefined', 'number', 'string', 'boolean', 'bigint'])

export const VALID_PRIMITIVE_CHILDREN = new Set(['number', 'string', 'bigint'])

export const PLAITED_TEMPLATE_IDENTIFIER = '🦄'
