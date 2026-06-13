import {
  type Behavioral,
  type BPEvent,
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

type InitArgs = Omit<ReturnType<Behavioral>, 'useSnapshot'> & { topic: string; workflow: string; cwd: string }
type DefineBehaviorArgs = Omit<ReturnType<Behavioral>, 'useSnapshot'> & {
  sync: Sync
  thread: Thread
}

type BProgram = (args: DefineBehaviorArgs) => void | Promise<void>

export type DefineBehavior = (bProgram: BProgram) => {
  (args: InitArgs): Promise<void>
  $: typeof B_PROGRAM_IDENTIFIER
}

export const defineBehavior = (bProgram: BProgram) => {
  const init = async ({ trigger: baseTrigger, topic, ...args }: InitArgs) => {
    const trigger: Trigger = ({ type, detail }) => {
      baseTrigger({
        type,
        topic,
        detail: {
          ...(detail && detail),
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
            topic,
            detail: {
              ...(detail && detail),
            },
          }
          continue
        }
        const value = idioms[idiom]
        args[idiom] = ensureArray(value).map((listener) => ({
          ...listener,
          topic,
        }))
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
  init.$ = B_PROGRAM_IDENTIFIER
  return init
}
