import { Listener, plait, Strategy, Trigger } from '../plait/mod.ts'
import { noop } from '../utils/mod.ts'

export const usePlait = ({
  id,
  connect,
  logger,
  strategy,
  context,
}: {
  logger?: Listener
  strategy?: Strategy
  connect?: (recipient: string, trigger: Trigger) => () => void
  id?: string
  context: HTMLElement
}) => {
  const { feedback, trigger, stream, add, lastEvent } = plait({
    strategy,
    dev: Boolean(logger),
  })
  logger && stream.subscribe(logger)
  let disconnect = noop
  if (!context.tagName) {
    console.error('usePlait must be called from within a CustomElement Class')
  }
  if (connect && context) {
    const _id = id || context.tagName.toLowerCase()
    disconnect = connect(id || context.tagName.toLowerCase(), trigger)
    trigger({ type: `connected->${_id}` })
  }
  return { trigger, disconnect, add, feedback, lastEvent }
}
