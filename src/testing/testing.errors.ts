import { ERROR_TYPES } from './testing.constants.ts'

/**
 * Error thrown when test assertion fails.
 * Contains detailed comparison information.
 */
export class FailedAssertionError extends Error implements Error {
  override name = ERROR_TYPES.failed_assertion
}

/**
 * Error thrown when assertion parameters are missing.
 * Indicates incomplete test configuration.
 */
export class MissingAssertionParameterError extends Error implements Error {
  override name = ERROR_TYPES.missing_assertion_parameter
}

/**
 * Error thrown when accessibility violations detected.
 * Contains axe-core violation details.
 */
export class AccessibilityError extends Error implements Error {
  override name = ERROR_TYPES.accessibility_violation
}
