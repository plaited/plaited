import { Plait, RulesFunc, TriggerFunc, Listener, Strategy } from '@plaited/plait'
import { noop } from '@plaited/utils'

export type UsePlait = (args: {
  strands?: Record<string, RulesFunc>
  actions?: Record<string, (payload?: any) => void>
  logger?: Listener
  strategy?: Strategy;
  connect?: (recipient: string, cb: TriggerFunc) => () => void
  context?: HTMLElement
  id?: string
}) => { trigger: TriggerFunc, disconnect: () => void}

export const usePlait: UsePlait = ({
  strands = {},
  actions = {},
  id,
  connect,
  context,
  logger,
  strategy,
} = {})  => {
  const { feedback, trigger, stream } = new Plait(strands, { strategy, dev: Boolean(logger) })
  logger && stream.subscribe(logger)
  feedback(actions)
  let disconnect = noop
  if(connect && context){
    const _id = id || context.tagName.toLowerCase()
    disconnect = connect(id || context.tagName.toLowerCase(), trigger)
    trigger({ eventName: `connected->${_id}` })
  }
  return { trigger, disconnect }
}
