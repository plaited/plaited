import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import {
  type Handlers,
  type UseSnapshot,
  type BThreads,
  type Trigger,
  bProgram,
  type Disconnect,
  type UseFeedback,
} from './b-program.js'
import { getPublicTrigger } from './get-public-trigger.js'

export type PublicTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}

export type BProgramProps = {
  bSync: BSync
  bThread: BThread
  bThreads: BThreads
  trigger: Trigger
  useSnapshot: UseSnapshot
}

export type BProgramCallback<A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>> = (
  props: BProgramProps & C,
) => A

export type DefineBProgram = () => {
  <C extends Record<string, unknown> = never>(ctx?: C): PublicTrigger
  useFeedback: UseFeedback
  trigger: Trigger
}

export const defineBProgram = <A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>>(args: {
  publicEvents: string[]
  disconnectSet?: Set<Disconnect>
  bProgram: BProgramCallback<A, C>
}) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  const init = (ctx?: C) => {
    const actions = args.bProgram({ ...rest, trigger, bSync, bThread, ...(ctx ?? ({} as C)) })
    useFeedback(actions)
    return getPublicTrigger({ trigger, publicEvents: args.publicEvents, disconnectSet: args?.disconnectSet })
  }
  init.useFeedback = useFeedback
  init.trigger = trigger
  return init
}
