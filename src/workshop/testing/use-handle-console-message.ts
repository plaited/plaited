import { type ConsoleMessage, type Page } from 'playwright'
import type { Trigger } from '../../behavioral/b-program.js'
import type { BPEvent } from '../../behavioral/b-thread.js'
import { isTypeOf } from '../../utils/is-type-of.js'
import { type TestParams } from '../workshop.types.js'

const isBPEvent = (obj: unknown): obj is BPEvent => {
  if (!isTypeOf<Record<string, unknown>>(obj, 'object')) return false
  if (Object.keys(obj).length !== 2) return false
  if (Object.hasOwn(obj, 'type')) return false
  return true
}

export const useHandleConsoleMessage = ({
  trigger,
  params,
  colorScheme,
  page,
}: {
  trigger: Trigger
  params: TestParams
  colorScheme?: 'light' | 'dark'
  page: Page
}) => {
  return async (msg: ConsoleMessage): Promise<void> => {
    // Check if the message type is 'dir'
    if (msg.type() === 'dir') {
      // The arguments of the console message are JSHandles
      const args = msg.args()
      for (const arg of args) {
        // Retrieve the JSON representation of the object
        const jsonValue = await arg.jsonValue()
        // Log the object, using JSON.stringify for a nice format
        if (isBPEvent(jsonValue)) {
          const { type, detail } = jsonValue
          trigger({
            type,
            detail: {
              fixtureEventDetail: detail,
              colorScheme,
              page,
              ...params,
            },
          })
        }
      }
    }
  }
}
