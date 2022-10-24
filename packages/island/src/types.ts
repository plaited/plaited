import { TriggerFunc, RulesFunc, Strategy, Listener } from '@plaited/behavioral'

export type QueryTargets = (selector: string) => Element[]
export type Actions = (args: {
  $: QueryTargets,
  root: ShadowRoot
}) => Record<string, (payload?: any) => void>
export type DefineIsland = (tag: string, config:  {
  actions: Actions
  strands?: Record<string, RulesFunc>
  connect?: (recipient: string, cb: TriggerFunc) => () => void
  /** @defaultValue 'open' */
  mode?: 'open' | 'closed'
  delegatesFocus?: boolean
  logger?: Listener
  strategy?: Strategy;
}) => void
