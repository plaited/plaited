/** Error type identifier for failed assertions within a play function. */
export const FAILED_ASSERTION = 'FAILED_ASSERTION'
/** Error type identifier when required assertiom parameters are missing. */
export const MISSING_ASSERTION_PARAMETER = 'MISSING_ASSERTION_PARAMETER'
/** Error type identifier when timeout error occurs. */
export const ACCESSIBILITY_VIOLATION = 'ACCESSIBILITY_VIOLATION'

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

/**
 * Custom error for accessibility violations error
 * Thrown when timeout a11y finds an violation
 *
 * @extends Error
 * @property name Constant identifier 'ACCESSIBILITY_VIOLATION'
 */
export class AccessibilityError extends Error implements Error {
  override name = ACCESSIBILITY_VIOLATION
  constructor(message: string) {
    super(message)
  }
}

