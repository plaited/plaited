import * as z from 'zod'

/**
 * Zod schema for validating `RunnerMessage` objects.
 * This schema ensures that messages received from the story fixture conform to the expected structure,
 * including properties like `colorScheme`, `pathname`, and a `snapshot` array with specific object shapes.
 * It is used by the story runner to validate incoming data.
 */
export const RunnerMessageSchema = z.object({
  colorScheme: z.enum(['light', 'dark']),
  pathname: z.string(),
  snapshot: z.array(
    z.object({
      thread: z.string(),
      trigger: z.boolean(),
      selected: z.boolean(),
      type: z.string(),
      detail: z.optional(z.unknown()),
      priority: z.number(),
      blockedBy: z.optional(z.string()),
      interrupts: z.optional(z.string()),
    }),
  ),
})

/**
 * Represents a message structure used by the story runner, likely for communication
 * between different parts of the test execution environment (e.g., test runner and reporter, or main thread and worker).
 *
 * @property colorScheme - Indicates the color scheme (e.g., 'light', 'dark') active during the test run or for rendering.
 * @property snapshot - A `SnapshotMessage` from the behavioral program, capturing its state at a relevant point in time for the story.
 * @property pathname - The path or unique identifier of the story being run or reported on.
 */
export type RunnerMessage = z.infer<typeof RunnerMessageSchema>
