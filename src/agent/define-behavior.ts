import * as z from 'zod'
import {
  type Behavioral,
  type BPEvent,
  type BPListener,
  sync as baseSync,
  ensureArray,
  IDIOMS,
  type Idioms,
  type Sync,
  type Thread,
  type Trigger,
  thread,
} from '../behavioral.ts'
import { B_PROGRAM_IDENTIFIER } from './agent.constants.ts'

type GetThreadsArgs = Omit<ReturnType<Behavioral>, 'useSnapshot'> & { topic: string }
type DefineBehaviorArgs = Omit<ReturnType<Behavioral>, 'useSnapshot'> & {
  sync: Sync
  thread: Thread
}

type BProgram = (args: DefineBehaviorArgs) => void | Promise<void>

const mapTopic = (topic: string, arr: BPListener[]): BPListener[] =>
  arr.map(({ detailSchema, ...listener }) => ({
    ...listener,
    detailSchema: detailSchema?.and(z.object({ topic: z.literal(topic) })) ?? z.object({ topic: z.literal(topic) }),
  }))

export type DefineBehavior = (bProgram: BProgram) => {
  (args: GetThreadsArgs): Promise<void>
  $: typeof B_PROGRAM_IDENTIFIER
}

export const defineBehavior = (bProgram: BProgram) => {
  const getProgram = async ({ trigger: baseTrigger, topic, ...args }: GetThreadsArgs) => {
    const trigger: Trigger = ({ type, detail }) => {
      baseTrigger({
        type,
        detail: {
          ...(detail && detail),
          topic,
        },
      })
    }
    const sync: Sync = (idioms) => {
      const args: Idioms = {}
      for (const key in idioms) {
        const idiom = key as keyof Idioms
        if (idiom === IDIOMS.request) {
          const { type, detail } = idioms[idiom] as BPEvent
          args[idiom] = {
            type: type,
            detail: {
              ...(detail && detail),
              topic,
            },
          }
          continue
        }
        const value = idioms[idiom]
        args[idiom] = mapTopic(topic, ensureArray(value))
      }
      return baseSync(args)
    }
    await bProgram({
      ...args,
      trigger,
      sync,
      thread,
    })
  }
  getProgram.$ = B_PROGRAM_IDENTIFIER
  return getProgram
}
