import { sync, loop, thread, BPEvent } from 'plaited'
import { keyMirror } from '@plaited/utils'
import { crudTypes } from './utils.js'

export const types = {
  ...keyMirror(
    ...crudTypes('MODULE_DESCRIPTION'),
    ...crudTypes('MODULE_CHANNEL'),
    ...crudTypes('MODULE_CHANNEL_BOUNDARIES'),
    'ADD_MODULE_TO_BLOCK',
    'REMOVE_MODULE_FROM_BLOCK',
    'CONNECT_MODULE_TO_NETWORK',
    'DISCONNECT_MODULE_FROM_NETWORK',
  ),
} as const
