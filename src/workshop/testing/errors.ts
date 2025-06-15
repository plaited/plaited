/** Error type identifier for failed assertions within a play function. */
export const FAILED_ASSERTION = 'FAILED_ASSERTION'
/** Error type identifier when required assertiom parameters are missing. */
export const MISSING_ASSERTION_PARAMETER = 'MISSING_ASSERTION_PARAMETER'

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
export class MissingAssertionParameterError extends Error implements Error {
  override name = MISSING_ASSERTION_PARAMETER
  constructor(message: string) {
    super(message)
  }
}
