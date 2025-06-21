import { type ConsoleMessage, type BrowserContext } from 'playwright'
import type { Trigger } from '../../behavioral/b-program.js'
import { type StoryParams } from '../workshop.types.js'
import { SnapshotMessageSchema } from './testing.schema.js'
import { TESTING_EVENTS } from './testing.constants.js'
import type { LogMessageDetail } from './testing.types.js'

export const useHandleConsoleMessage = ({
  trigger,
  params,
  colorScheme,
  context,
}: {
  trigger: Trigger
  params: StoryParams
  colorScheme: 'light' | 'dark'
  context: BrowserContext
}) => {
  return async (msg: ConsoleMessage): Promise<void> => {
    // Check if the message type is 'dir'
    if (msg.type() === 'table') {
      // The arguments of the console message are JSHandles
      const args = msg.args()
      for (const arg of args) {
        // Retrieve the JSON representation of the object
        const snapshot = await arg.jsonValue()
        // Log the object, using JSON.stringify for a nice format
        const result = SnapshotMessageSchema.safeParse(snapshot)
        if (result.success) {
          trigger<LogMessageDetail>({
            type: TESTING_EVENTS.log_event,
            detail: {
              snapshot: result.data,
              colorScheme,
              context,
              ...params,
            },
          })
        }
      }
    }
  }
}
