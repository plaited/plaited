import { isTypeOf } from '@plaited/utils'
import type { Logger } from '../types.js'
import { PLAITED_LOGGER } from './constants.js'

export const hasLogger = <T>(win: Window): win is Window & { logger: Logger<T> } =>
  PLAITED_LOGGER in win && isTypeOf<Logger<T>>(win[PLAITED_LOGGER], 'function')

export const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'
