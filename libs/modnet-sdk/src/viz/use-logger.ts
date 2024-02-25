import { defaultLogger } from 'plaited/utils'
import type { DefaultLogCallbackParams } from 'plaited'

export const useLogger = (arr: DefaultLogCallbackParams[]) => {
  const logger = defaultLogger
  logger.callback = (log) => arr.push(log)
  return logger
}
