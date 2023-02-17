import { bProgram, Listener, Strategy, Trigger } from '../behavioral/mod.ts'
import { noop } from '../utils/mod.ts'

export const useBehavioral = ({
  id,
  connect,
  logger,
  strategy,
  context,
}: {
  logger?: Listener
  strategy?: Strategy
  connect?: (recipient: string, trigger: Trigger) => () => void
  id?: boolean
  context: HTMLElement
}) => {
  const { feedback, trigger, stream, add, lastEvent } = bProgram({
    strategy,
    dev: Boolean(logger),
  })
  logger && stream.subscribe(logger)
  let disconnect = noop
  if (!context.tagName) {
    console.error('usePlait must be called from within a CustomElement Class')
  }
  if (connect && context) {
    const tagName = context.tagName.toLowerCase()
    const _id = context.id
    if (id && !_id) {
      console.log(
        `island ${tagName} is missing an id attribute and cannot communicate with messenger`,
      )
    }
    disconnect = id && _id ? connect(_id, trigger) : connect(tagName, trigger)
    trigger({
      type: `connected->${id ? _id ?? `${tagName} with missing id` : tagName}`,
    })
  }
  return { trigger, disconnect, add, feedback, lastEvent }
}
