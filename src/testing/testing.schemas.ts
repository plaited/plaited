import { z } from 'zod'
import { INSPECTOR_MESSAGE, type InspectorMessageDetail } from '../main.ts'
import { isTypeOf } from '../utils/is-type-of.ts'
import { AGENT_EVENTS, FIXTURE_EVENTS } from './testing.constants.ts'
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

export const InspectorMessageSchema = z.object({
  type: z.literal(INSPECTOR_MESSAGE),
  detail: z.custom<InspectorMessageDetail>((val) => {
    if (!isTypeOf<Record<string, unknown>>(val, 'object')) return false
    const { element, message } = val
    // Validate element is a CustomElementTag (contains hyphen)
    if (!isTypeOf<string>(element, 'string') || !/^.+-.+$/.test(element)) return false
    // Validate message is an array
    if (!isTypeOf<unknown[]>(message, 'array')) return false
    // Validate each snapshot in the array
    return message.every((snapshot) => {
      if (!isTypeOf<Record<string, unknown>>(snapshot, 'object')) return false
      const { thread, trigger, selected, type, priority } = snapshot
      return (
        isTypeOf<string>(thread, 'string') &&
        isTypeOf<boolean>(trigger, 'boolean') &&
        isTypeOf<boolean>(selected, 'boolean') &&
        isTypeOf<string>(type, 'string') &&
        isTypeOf<number>(priority, 'number')
      )
    })
  }),
})

/**
 * Zod schema for agent message structure.
 * Represents messages sent from AI agents to the client UI.
 *
 * @remarks
 * Used for bidirectional communication in the Workshop Agent system,
 * allowing AI agents to send real-time updates, insights, or instructions
 * to the client during test execution or story development.
 */
export const AgentMessageSchema = z.object({
  type: z.literal(AGENT_EVENTS.agent_message),
  detail: z.object({
    content: z.string(),
    timestamp: z.number(),
    agentId: z.string().optional(),
  }),
})

/**
 * Zod schema for runner message union type.
 * Discriminated union of test result and UI snapshot messages.
 *
 * @remarks
 * Used for communication between different parts of the test execution
 * environment (e.g., test runner and reporter, or main thread and worker).
 * Discriminated by the 'type' field for type-safe message handling.
 */
export const RunnerMessageSchema = z.discriminatedUnion('type', [
  PassMessageSchema,
  FailMessageSchema,
  InspectorMessageSchema,
  AgentMessageSchema,
])

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
 * Inferred type for agent message.
 * Represents messages sent from AI agents to the client UI.
 */
export type AgentMessage = z.infer<typeof AgentMessageSchema>

/**
 * Inferred type for runner message union.
 * Represents a message structure used by the story runner for communication
 * between different parts of the test execution environment.
 *
 * @remarks
 * This is a discriminated union type that can be either:
 * - PassMessage: Successful test execution with pathname
 * - FailMessage: Failed test execution with pathname, error, and errorType
 * - FixtureSnapshotMessage: Behavioral program snapshot from story fixture
 * - OrchestratorSnapshotMessage: Behavioral program snapshot from story orchestrator
 * - MaskSnapshotMessage: Behavioral program snapshot from mask component
 * - HeaderSnapshotMessage: Behavioral program snapshot from header component
 */
export type RunnerMessage = z.infer<typeof RunnerMessageSchema>
