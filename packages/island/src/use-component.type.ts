import { RulesFunc } from '@plaited/plait'
import { Query } from './define-element.js'

export type UseComponent<T = Record<string, unknown>> = (args: {
  $: Query
} & T) => {
  actions: Record<string, (payload: unknown) => void>,
  strands: Record<string, RulesFunc>
}
