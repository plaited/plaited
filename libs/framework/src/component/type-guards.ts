import type { Logger } from '../behavioral/types.js'
import type { HDAHook } from './types.js'
import { isTypeOf } from '@plaited/utils'
import { PLAITED_LOGGER, PLAITED_CAPTURE_HOOK } from '../shared/constants.js'

export const hasLogger = (win: Window): win is Window & { [PLAITED_LOGGER]: Logger } =>
  PLAITED_LOGGER in win && isTypeOf<Logger>(win[PLAITED_LOGGER], 'function')

export const hasHDA = (win: Window): win is Window & { [PLAITED_CAPTURE_HOOK]: HDAHook } =>
  PLAITED_CAPTURE_HOOK in win && isTypeOf<HDAHook>(win[PLAITED_CAPTURE_HOOK], 'function')
