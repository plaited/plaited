import { keyMirror } from '../utils/key-mirror.js'

export const PLAITED_STORE = 'PLAITED_STORE'
export const PLAITED_INDEXED_DB = 'PLAITED_INDEXED_DB'

export const ELEMENT_CALLBACKS = keyMirror(
  'onAdopted',
  'onAttributeChanged',
  'onConnected',
  'onDisconnected',
  'onFormAssociated',
  'onFormDisabled',
  'onFormReset',
  'onFormStateRestore',
  'onReplaceChildren',
  'onPrepend',
  'onAppend',
)

export const PLAITED_TEMPLATE_IDENTIFIER = '🐻' as const
