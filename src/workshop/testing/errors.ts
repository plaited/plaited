import { FAILED_ASSERTION, MISSING_ASSERTION_PARAMETER, TIMEOUT_ERROR } from './testing.constants'

/**
 * Custom error for test assertion failures.
 * Thrown when an assertion condition is not met.
 *
 * @extends Error
 * @property name Constant identifier 'FAILED_ASSERTION'
 */
export class FailedAssertionError extends Error implements Error {
  override name = FAILED_ASSERTION
  constructor(message: string) {
    super(message)
  }
}
/**
 * Custom error for missing required test parameters.
 * Thrown when required test configuration is not provided.
 *
 * @extends Error
 * @property name Constant identifier 'MISSING_ASSERTION_PARAMETER'
 */
export class MissingAssertionParameterError extends Error {
  override name = MISSING_ASSERTION_PARAMETER
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
