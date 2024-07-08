import type { Logger } from '../behavioral/types.js'
import type { CaptureHook } from './types.js'
import { isTypeOf } from '@plaited/utils'
import { PLAITED_LOGGER, PLAITED_CAPTURE_HOOK, PLAITED_SOCKET_HOOK } from '../shared/constants.js'
import { UseSocket } from '../utils-client/types.js'

export const hasLogger = (win: Window): win is Window & { [PLAITED_LOGGER]: Logger } =>
  PLAITED_LOGGER in win && isTypeOf<Logger>(win[PLAITED_LOGGER], 'function')

export const hasCaptureHook = (win: Window): win is Window & { [PLAITED_CAPTURE_HOOK]: CaptureHook } =>
  PLAITED_CAPTURE_HOOK in win && isTypeOf<CaptureHook>(win[PLAITED_CAPTURE_HOOK], 'function')

export const hasSocketHook = (win: Window): win is Window & { [PLAITED_SOCKET_HOOK]: ReturnType<UseSocket> } => PLAITED_SOCKET_HOOK in win && isTypeOf<ReturnType<UseSocket>>(win[PLAITED_SOCKET_HOOK], 'function')