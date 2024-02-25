import { sync, loop, thread, BPEvent } from 'plaited'
import { keyMirror } from '@plaited/utils'
import { crudTypes } from './utils.js'

export const types = {
  ...keyMirror(
    ...crudTypes('BLOCK_DESCRIPTION'),
    ...crudTypes('BLOCK_SITUATIONAL_CONNECTEDNESS'),
    ...crudTypes('BLOCK_SYSTEM_CONNECTEDNESS'),
    'CONNECT_BLOCK_TO_NETWORK',
    'DISCONNECT_BLOCK_FROM_NETWORK',
  ),
} as const
