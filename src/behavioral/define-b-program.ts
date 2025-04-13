import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import { type Handlers, type UseSnapshot, type BThreads, bProgram, type Disconnect } from './b-program.js'
import { getPublicTrigger } from './get-public-trigger.js'
import { getPlaitedTrigger, type PlaitedTrigger } from './get-plaited-trigger.js'

/**
 * Configuration props for defining a behavioral program.
 * Contains core utilities needed for program initialization and execution.
 */
export type DefineBProgramProps = {
  bSync: BSync
  bThread: BThread
  bThreads: BThreads
  trigger: PlaitedTrigger
  useSnapshot: UseSnapshot
}
/**
 * Callback function type for behavioral program initialization.
 * @template A Type extending Handlers for event handling
 * @template C Type for additional context properties
 * @param props Combined props including core utilities and context
 * @returns Event handlers for the program
 */
type BProgramCallback<A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>> = (
  props: DefineBProgramProps & C,
) => A
/**
 * Creates a behavioral program with specified event handling and context.
 * @template A Type extending Handlers for event handling
 * @template C Type for additional context properties
 * @param args Configuration object containing:
 *  - publicEvents: List of exposed event types
 *  - disconnectSet: Optional set of cleanup functions
 *  - bProgram: Callback function defining program behavior
 * @returns An initialization function that:
 *  - Accepts optional context
 *  - Sets up event handlers
 *  - Returns a public trigger interface
 *  - Provides method to register cleanup callbacks
 */
export const defineBProgram = <A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>>({
  disconnectSet = new Set<Disconnect>(),
  ...args
}: {
  publicEvents: string[]
  disconnectSet?: Set<Disconnect>
  bProgram: BProgramCallback<A, C>
}) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  const init = (ctx?: C) => {
    const { bProgram, publicEvents } = args
    const handlers = bProgram({
      ...rest,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
      bSync,
      bThread,
      ...(ctx ?? ({} as C)),
    })
    useFeedback(handlers)
    return getPublicTrigger({ trigger, publicEvents })
  }
  init.addDisconnectCallback = (cb: Disconnect) => disconnectSet.add(cb)
  return init
}
