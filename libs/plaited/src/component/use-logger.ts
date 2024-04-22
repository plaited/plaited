import { Logger } from '../types.js'
import { PLAITED_LOGGER } from './constants.js'

export const useLogger = <T>(logger: Logger<T>) => {
  Object.assign(window, {
    [PLAITED_LOGGER]: logger,
  })
}
