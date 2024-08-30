import { keyMirror } from '@plaited/utils'
export const PLAITED_TEMPLATE_IDENTIFIER = Symbol('PLAITED TEMPLATE')
export const TEMPLATE_OBJECT_IDENTIFIER = Symbol('TEMPLATE OBJECT')
export const ACTION_INSERT = 'ACTION_INSERT' as const
export const INSERT_METHODS = keyMirror('append', 'prepend', 'replaceChildren')
export const ACTION_TRIGGER = 'ACTION_TRIGGER' as const
