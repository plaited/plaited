import { keyMirror } from '@plaited/utils'
export const PLAITED_TEMPLATE_IDENTIFIER = Symbol('PLAITED TEMPLATE')
export const TEMPLATE_OBJECT_IDENTIFIER = Symbol('TEMPLATE OBJECT')
export const UPDATE_LIGHT_DOM = 'UPDATE_LIGHT_DOM' as const
export const UPDATE_LIGHT_DOM_METHODS = keyMirror('append', 'prepend', 'replaceChildren')
export const TRIGGER_ELEMENT = 'TRIGGER_ELEMENT' as const
