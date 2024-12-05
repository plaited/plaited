import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import { type Handlers, type UseSnapshot, type BThreads, type Trigger, bProgram, type Disconnect } from './b-program.js'
import { getPublicTrigger } from './get-public-trigger.js'

export type DefineBProgramProps = {
  bSync: BSync
  bThread: BThread
  bThreads: BThreads
  trigger: Trigger
  useSnapshot: UseSnapshot
}

type BProgramCallback<A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>> = (
  props: DefineBProgramProps & C,
) => A

export const defineBProgram = <A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>>({
  disconnectSet,
  ...args
}: {
  publicEvents: string[]
  disconnectSet?: Set<Disconnect>
  bProgram: BProgramCallback<A, C>
}) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  if (disconnectSet) {
    Object.assign(trigger, {
      addDisconnectCallback: (cb: Disconnect) => disconnectSet.add(cb),
    })
  }
  const init = (ctx?: C) => {
    const { bProgram, publicEvents } = args
    const actions = bProgram({ ...rest, trigger, bSync, bThread, ...(ctx ?? ({} as C)) })
    useFeedback(actions)
    return getPublicTrigger({ trigger, publicEvents, disconnectSet })
  }
  init.useFeedback = useFeedback
  init.trigger = trigger
  return init
}
