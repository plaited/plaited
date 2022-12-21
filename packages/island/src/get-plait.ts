import { Plait, RulesFunc, TriggerFunc, Listener, Strategy } from '@plaited/behavioral'
import { noop } from '@plaited/utils'

export type GetPlait<T = HTMLElement> = (
  $: (selector: string) => Element[],
  context: T extends HTMLElement ? T : HTMLElement
) => { trigger: TriggerFunc, disconnect: () => void}

export const getPlait = <T = HTMLElement>({
  strands = {},
  actions,
  id,
  connect,
  context,
  logger,
  strategy,
}: {
  strands?: Record<string, RulesFunc>
  actions?: Record<string, (payload?: any) => void>
  id?: string
  connect?: (recipient: string, cb: TriggerFunc) => () => void
  context: T extends HTMLElement ? T : HTMLElement
  logger?: Listener
  strategy?: Strategy;
}): { trigger: TriggerFunc, disconnect: () => void} => {
  const { feedback, trigger, stream } = new Plait(strands, { strategy, dev: Boolean(logger) })
  logger && stream.subscribe(logger)
  actions && feedback(actions)
  let disconnect = noop
  if(connect){
    const _id = id || context.tagName.toLowerCase()
    disconnect = connect(id || context.tagName.toLowerCase(), trigger)
    trigger({ eventName: `connected->${_id}` })
  }
  return { trigger, disconnect }
}
