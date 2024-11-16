import type { ServerWebSocket } from 'bun'
import { type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.js'
import { type Actions, type UseSnapshot, type BThreads, type Trigger, bProgram } from '../behavioral/b-program.js'
import { getPublicTrigger } from '../client/get-public-trigger.js'
import type { JSONDetail } from '../client/client.types.js'

export type ModuleMessageDetail<T extends JSONDetail | undefined = undefined> = {
  ws: ServerWebSocket<unknown>
  message: T
}

type DefineModule = <A extends Actions>(args: {
  id: string
  publicEvents: string[]
  bProgram(
    props: {
      bSync: BSync
      bThread: BThread
      bThreads: BThreads
      trigger: Trigger
      useSnapshot: UseSnapshot
    },
    ctx?: Record<string, unknown>,
  ): A
}) => {
  (ctx?: Parameters<(typeof args)['bProgram']>[1]): Trigger
  id: string
}

export const defineModule: DefineModule = (args) => {
  const { useFeedback, trigger, ...rest } = bProgram()
  const init = (ctx?: Parameters<(typeof args)['bProgram']>[1]) => {
    const actions = args.bProgram({ ...rest, trigger, bSync, bThread }, ctx)
    useFeedback(actions)
    return getPublicTrigger({ trigger, publicEvents: args.publicEvents })
  }
  init.id = args.id
  return init
}
