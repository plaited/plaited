import { Logger } from '../types.js'
import { PlaitedLogger } from './constants.js'

export const useLogger = <T>(logger: Logger<T>) => {
  Object.assign(window, {
    [PlaitedLogger]: logger,
  })
}
