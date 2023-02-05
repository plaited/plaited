import { Listener, plait, Strategy, Trigger } from '../plait/mod.ts'
import { noop } from '../utils/mod.ts'

export const usePlait = ({
  id,
  connect,
  logger,
  strategy,
}: {
  logger?: Listener
  strategy?: Strategy
  connect?: (recipient: string, trigger: Trigger) => () => void
  id?: string
} = {}) => {
  const { feedback, trigger, stream, add } = plait({
    strategy,
    dev: Boolean(logger),
  })
  logger && stream.subscribe(logger)
  let disconnect = noop
  const context = this as unknown as HTMLElement
  if (!context.tagName) {
    console.error('usePlait must be called from within a CustomElement Class')
  }
  if (connect && context) {
    const _id = id || context.tagName.toLowerCase()
    disconnect = connect(id || context.tagName.toLowerCase(), trigger)
    trigger({ type: `connected->${_id}` })
  }
  return { trigger, disconnect, add, feedback }
}
