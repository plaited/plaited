export const P_HANDLER = 'p-handler'
export const P_WORKER = 'p-worker'
export const NAVIGATE_EVENT_TYPE = 'plaited:navigate'
export const PLAITED_STORE = 'PLAITED_STORE'
export const PLAITED_INDEXED_DB = 'PLAITED_INDEXED_DB'

export const callbacks = {
  onAttributeChanged: 'onAttributeChanged',
  onConnected: 'onConnected',
  onAdopted: 'onAdopted',
  onDisconnected: 'onDisconnected',
  onFormAssociated: 'onFormAssociated',
  onFormStateRestore: 'onFormStateRestore',
  onFormReset: 'onFormReset',
  onFormDisabled: 'onFormDisabled',
} as const
