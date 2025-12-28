import { z } from 'zod'
import { FIXTURE_EVENTS, UI_SNAPSHOT_EVENTS } from './testing.constants.ts'

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
 * Zod schema for behavioral program snapshot message array.
 * Represents the state of all thread bids in a super-step.
 *
 * @remarks
 * Each element represents a thread's bid containing event selection details,
 * blocking relationships, and interruption information from the behavioral
 * program's execution.
 */
const SnapshotMessageArraySchema = z.array(
  z.object({
    thread: z.string(),
    trigger: z.boolean(),
    selected: z.boolean(),
    type: z.string(),
    detail: z.unknown().optional(),
    priority: z.number(),
    blockedBy: z.string().optional(),
    interrupts: z.string().optional(),
  }),
)

/**
 * Zod schema for fixture snapshot message structure.
 * Represents behavioral program snapshot from story fixture.
 *
 * @remarks
 * Used for communication between story fixture and test runner
 * to report behavioral program state snapshots including thread bids,
 * event selection, blocking, and interruption information.
 */
export const FixtureSnapshotMessageSchema = z.object({
  type: z.literal(UI_SNAPSHOT_EVENTS.fixture_snapshot),
  detail: SnapshotMessageArraySchema,
})

/**
 * Zod schema for orchestrator snapshot message structure.
 * Represents behavioral program snapshot from story orchestrator.
 *
 * @remarks
 * Used for communication between story orchestrator and test runner
 * to report behavioral program state snapshots.
 */
export const OrchestratorSnapshotMessageSchema = z.object({
  type: z.literal(UI_SNAPSHOT_EVENTS.orchestrator_snapshot),
  detail: SnapshotMessageArraySchema,
})

/**
 * Zod schema for mask snapshot message structure.
 * Represents behavioral program snapshot from mask component.
 *
 * @remarks
 * Used for communication between mask component and test runner
 * to report behavioral program state snapshots.
 */
export const MaskSnapshotMessageSchema = z.object({
  type: z.literal(UI_SNAPSHOT_EVENTS.mask_snapshot),
  detail: SnapshotMessageArraySchema,
})

/**
 * Zod schema for header snapshot message structure.
 * Represents behavioral program snapshot from header component.
 *
 * @remarks
 * Used for communication between header component and test runner
 * to report behavioral program state snapshots.
 */
export const HeaderSnapshotMessageSchema = z.object({
  type: z.literal(UI_SNAPSHOT_EVENTS.header_snapshot),
  detail: SnapshotMessageArraySchema,
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
  FixtureSnapshotMessageSchema,
  OrchestratorSnapshotMessageSchema,
  MaskSnapshotMessageSchema,
  HeaderSnapshotMessageSchema,
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
 * Inferred type for fixture snapshot message.
 * Represents behavioral program snapshot from story fixture.
 */
export type FixtureSnapshotMessage = z.infer<typeof FixtureSnapshotMessageSchema>

/**
 * Inferred type for orchestrator snapshot message.
 * Represents behavioral program snapshot from story orchestrator.
 */
export type OrchestratorSnapshotMessage = z.infer<typeof OrchestratorSnapshotMessageSchema>

/**
 * Inferred type for mask snapshot message.
 * Represents behavioral program snapshot from mask component.
 */
export type MaskSnapshotMessage = z.infer<typeof MaskSnapshotMessageSchema>

/**
 * Inferred type for header snapshot message.
 * Represents behavioral program snapshot from header component.
 */
export type HeaderSnapshotMessage = z.infer<typeof HeaderSnapshotMessageSchema>

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
