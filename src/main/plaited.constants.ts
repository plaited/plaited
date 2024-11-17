import { keyMirror } from '../utils/key-mirror.js'

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
