import type { AssertionErrorInterface } from './types.js'
import { ASSERTION_ERROR_NAME, TIMEOUT_ERROR_NAME } from './constants.js'

export class AssertionError extends Error implements AssertionErrorInterface {
  override name = ASSERTION_ERROR_NAME
  constructor(message: string) {
    super(message)
  }
}
export class TimeoutError extends Error {
  override name = TIMEOUT_ERROR_NAME
  constructor(message: string) {
    super(message)
  }
}
