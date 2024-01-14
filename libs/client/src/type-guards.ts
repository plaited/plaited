import type { Logger } from '@plaited/behavioral'
import type { PlaitedElement } from '@plaited/types'
import { isTypeOf } from '@plaited/utils'
import { PlaitedLogger } from './constants.js'
/** @description utility function to check if Element is Plaited Component */
export const isPlaited = (el: Element): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

export const hasLogger = <T>(win: Window): win is Window & { logger: Logger<T> } =>
  PlaitedLogger in win && isTypeOf<Logger<T>>(win[PlaitedLogger], 'function')
