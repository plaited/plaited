import { ASSERTION_ERROR, MISSING_TEST_PARAMS_ERROR, TIMEOUT_ERROR } from './assert.constants.js'

/**
 * Custom error for test assertion failures.
 * Thrown when an assertion condition is not met.
 *
 * @extends Error
 * @property name Constant identifier 'ASSERTION_ERROR'
 */
export class AssertionError extends Error implements Error {
  override name = ASSERTION_ERROR
  constructor(message: string) {
    super(message)
  }
}
/**
 * Custom error for missing required test parameters.
 * Thrown when required test configuration is not provided.
 *
 * @extends Error
 * @property name Constant identifier 'MISSING_TEST_PARAMS_ERROR'
 */
export class MissingTestParamsError extends Error {
  override name = MISSING_TEST_PARAMS_ERROR
  constructor(message: string) {
    super(message)
  }
}
/**
 * Custom error for test timeout scenarios.
 * Thrown when a test exceeds its specified timeout duration.
 *
 * @extends Error
 * @property name Constant identifier 'TIMEOUT_ERROR'
 *
 */
export class TimeoutError extends Error {
  override name = TIMEOUT_ERROR
  constructor(message: string) {
    super(message)
  }
}
