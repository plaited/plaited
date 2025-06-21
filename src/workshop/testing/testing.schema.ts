import { z } from 'zod/v4'
import type { SnapshotMessage } from '../../behavioral/b-program.js'
import { FIXTURE_EVENTS } from './testing.constants.js'
import type { ValueOf } from '../../utils/value-of.type.js'

type SnapshotMessageBid = SnapshotMessage[number]

export interface PlaitedFixtureSnapshotMessageBid extends SnapshotMessageBid {
  type: ValueOf<typeof FIXTURE_EVENTS>
}

export type PlaitedFixtureSnapshotMessage = PlaitedFixtureSnapshotMessageBid[]

const MessageBidSchema = z.object({
  thread: z.string(),
  trigger: z.boolean(),
  selected: z.boolean(),
  type: z.literal(Object.values(FIXTURE_EVENTS)),
  detail: z.optional(z.unknown()),
  priority: z.number(),
  blockedBy: z.optional(z.string()),
  interrupts: z.optional(z.string()),
})

export const SnapshotMessageSchema = MessageBidSchema.array()

type CheckSame<
  TS_TYPE,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TS_TYPE_REPEAT extends INFERRED_ZOD_TYPE,
  INFERRED_ZOD_TYPE extends TS_TYPE,
> = never

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type Checks = [
  CheckSame<PlaitedFixtureSnapshotMessage, PlaitedFixtureSnapshotMessage, z.infer<typeof SnapshotMessageSchema>>,
]
