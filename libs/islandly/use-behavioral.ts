import { bProgram, DevCallback, Strategy, Trigger } from '../behavioral/mod.ts'

export const useBehavioral = ({
  id,
  connect,
  dev,
  strategy,
  context,
}: {
  /** sets a behavioral program for island to dev and captures reactive stream logs */
  dev?: DevCallback
  /** Set the island's behavioral program strategy */
  strategy?: Strategy
  /** wires the messenger connect to the behavioral programs trigger */
  connect?: (recipient: string, trigger: Trigger) => () => void
  /** optional and useful for when you're making a new primitive like a datepicker
   *  where there can be multiple on the screen, use this instead of the tag name to connect to messenger
   * If an id attribute is missing the island will console.error
   */
  id?: boolean
  /** reference to the node instance of the Island HTMLElement calling this hook */
  context: HTMLElement
}) => {
  const { trigger, ...rest } = bProgram({
    strategy,
    dev,
  })
  let disconnect
  if (connect) {
    const tagName = context.tagName.toLowerCase()
    const _id = context.id
    if (id && !_id) {
      console.error(
        `island ${tagName} is missing an id attribute and cannot communicate with messenger`,
      )
    }
    disconnect = id && _id ? connect(_id, trigger) : connect(tagName, trigger)
    trigger({
      event: `connected->${id ? _id ?? `${tagName} with missing id` : tagName}`,
    })
  }
  return { trigger, disconnect, ...rest }
}
