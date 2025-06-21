import { FIXTURE_EVENTS } from './testing.constants.js'
/**
 * Custom error for test assertion failures.
 * Thrown when an assertion condition is not met.
 *
 * @extends Error
 * @property name Constant identifier 'FAILED_ASSERTION'
 */
export class FailedAssertionError extends Error implements Error {
  override name = FIXTURE_EVENTS.failed_assertion
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
  override name = FIXTURE_EVENTS.missing_assertion_parameter
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
  override name = FIXTURE_EVENTS.accessibility_violation
  constructor(message: string) {
    super(message)
  }
}
