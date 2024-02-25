import { sync, loop, thread, BPEvent } from 'plaited'
import { keyMirror } from '@plaited/utils'
import { crudTypes } from './utils.js'

export const types = {
  ...keyMirror(
    ...crudTypes('NETWORK_QUERY_BOUNDARIES'),
    ...crudTypes('NETWORK_DESCRIPTION'),
    ...crudTypes('NETWORK_STRUCTURE'),
  ),
} as const
