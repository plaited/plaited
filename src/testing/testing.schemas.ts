import { z } from 'zod'
import { FIXTURE_EVENTS } from './testing.constants.ts'

/**
 * Zod schema for test pass message structure.
 * Represents successful test execution result.
 *
 * @remarks
 * Used for communication between story fixture and test runner
 * to report successful test completion with pathname information.
 */
export const PassMessageSchema = z.object({
  type: z.literal(FIXTURE_EVENTS.test_pass),
  detail: z.object({
    pathname: z.string(),
  }),
})

/**
 * Zod schema for test fail message structure.
 * Represents failed test execution result with error details.
 *
 * @remarks
 * Used for communication between story fixture and test runner
 * to report test failures with pathname, error message, and error type.
 */
export const FailMessageSchema = z.object({
  type: z.literal(FIXTURE_EVENTS.test_fail),
  detail: z.object({
    pathname: z.string(),
    error: z.string(),
    errorType: z.string(),
  }),
})

/**
 * Zod schema for runner message union type.
 * Discriminated union of pass and fail messages.
 *
 * @remarks
 * Used for communication between different parts of the test execution
 * environment (e.g., test runner and reporter, or main thread and worker).
 * Discriminated by the 'type' field for type-safe message handling.
 */
export const RunnerMessageSchema = z.discriminatedUnion('type', [PassMessageSchema, FailMessageSchema])

/**
 * Inferred type for test pass message.
 * Represents successful test execution result.
 */
export type PassMessage = z.infer<typeof PassMessageSchema>

/**
 * Inferred type for test fail message.
 * Represents failed test execution result with error details.
 */
export type FailMessage = z.infer<typeof FailMessageSchema>

/**
 * Inferred type for runner message union.
 * Represents a message structure used by the story runner for communication
 * between different parts of the test execution environment.
 *
 * @remarks
 * This is a discriminated union type that can be either:
 * - PassMessage: Successful test execution with pathname
 * - FailMessage: Failed test execution with pathname, error, and errorType
 */
export type RunnerMessage = z.infer<typeof RunnerMessageSchema>
