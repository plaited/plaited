import { Plait, RulesFunc, TriggerFunc, Listener, Strategy } from '@plaited/behavioral'


export type Actions<T = HTMLElement> = (
  $: (selector: string) => Element[],
  context: T extends HTMLElement ? T : HTMLElement
) => Record<string, (payload?: any) => void>

export const getPlait = <T = HTMLElement>({
  strands = {},
  actions,
  id,
  connect,
  logger,
  strategy,
}: {
  strands?: Record<string, RulesFunc>
  actions?: Actions<T>
  id?: string
  connect?: (recipient: string, cb: TriggerFunc) => () => void
  logger?: Listener
  strategy?: Strategy;
}) => ($:(id: string) => Element[], context:  T extends HTMLElement ? T : HTMLElement) => {
    const { feedback, trigger, stream } = new Plait(strands, { strategy, dev: Boolean(logger) })
    logger && stream.subscribe(logger)
    actions && feedback(actions($, context))
    let disconnect
    if(connect){
      const _id = id || context.tagName.toLowerCase()
      disconnect = connect(id || context.tagName.toLowerCase(), trigger)
      trigger({ eventName: `connected->${_id}` })
    }
    return { trigger, disconnect }
  }
