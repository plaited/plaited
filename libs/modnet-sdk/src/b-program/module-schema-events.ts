import { sync, loop, thread, BPEvent } from 'plaited'
import { keyMirror } from '@plaited/utils'
import { crudTypes } from './utils.js'

export const types = {
  ...keyMirror(
    ...crudTypes('MODULE_SCHEMA_SCALE'),
    ...crudTypes('MODULE_SCHEMA_DESCRIPTION'),
    ...crudTypes('MODULE_SCHEMA_ACTIONS'),
    ...crudTypes('MODULE_SCHEMA_CHANNELS'),
    ...crudTypes('MODULE_SCHEMA_MICROINTERACTIONS'),
  ),
} as const
