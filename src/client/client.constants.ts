import { keyMirror } from '../utils/key-mirror.js'

export const PLAITED_STORE = 'PLAITED_STORE' as const
export const PLAITED_INDEXED_DB = 'PLAITED_INDEXED_DB' as const

export const ELEMENT_CALLBACKS = {
  onAdopted: 'onAdopted',
  onAttributeChanged: 'onAttributeChanged',
  onDisconnected: 'onDisconnected',
  onFormAssociated: 'onFormAssociated',
  onFormDisabled: 'onFormDisabled',
  onFormReset: 'onFormReset',
  onFormStateRestore: 'onFormStateRestore',
} as const

export const ACTION_INSERT = 'ACTION_INSERT' as const
export const INSERT_METHODS = keyMirror('append', 'prepend', 'replaceChildren')
export const ACTION_TRIGGER = 'ACTION_TRIGGER' as const
export const PLAITED_TEMPLATE_IDENTIFIER = Symbol('PLAITED TEMPLATE')

export const DISCONNECT_IDENTIFIER = Symbol('DISCONNECT IDENTIFIER')