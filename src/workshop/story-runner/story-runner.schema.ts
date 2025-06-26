import { z } from 'zod/v4'
import type { RunnerMessage } from '../story-fixture/story-fixture.types.js'

export const RunnerMessageSchema = z.object({
  colorScheme: z.string(),
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

type CheckSame<
  TS_TYPE,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TS_TYPE_REPEAT extends INFERRED_ZOD_TYPE,
  INFERRED_ZOD_TYPE extends TS_TYPE,
> = never

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Checks = [CheckSame<RunnerMessage, RunnerMessage, z.infer<typeof RunnerMessageSchema>>]
