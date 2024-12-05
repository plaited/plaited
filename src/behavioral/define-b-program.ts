import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import { type Handlers, type UseSnapshot, type BThreads, bProgram, type Disconnect } from './b-program.js'
import { getPublicTrigger } from './get-public-trigger.js'
import { getPlaitedTrigger, type PlaitedTrigger } from './get-plaited-trigger.js'
export type DefineBProgramProps = {
  bSync: BSync
  bThread: BThread
  bThreads: BThreads
  trigger: PlaitedTrigger
  useSnapshot: UseSnapshot
}

type BProgramCallback<A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>> = (
  props: DefineBProgramProps & C,
) => A

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
    const actions = bProgram({
      ...rest,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
      bSync,
      bThread,
      ...(ctx ?? ({} as C)),
    })
    useFeedback(actions)
    return getPublicTrigger({ trigger, publicEvents })
  }
  init.addDisconnectCallback = (cb: Disconnect) => disconnectSet.add(cb)
  return init
}
