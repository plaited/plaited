import { keyMirror } from '@plaited/utils'

export const PLAITED_COMPONENT_IDENTIFIER = '🐻' as const
export const NAVIGATE_EVENT_TYPE = 'plaited-navigate' as const
/** attribute used to wire a dom element to a useMessenger exchange */
export const BP_ADDRESS = 'bp-address' as const
export const BP_SOCKET = 'bp-socket' as const
export const BP_MODULE = 'bp-module' as const
export const BP_HREF = 'bp-href' as const
export const BP_MODULE_SCALE = keyMirror('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'rel')
