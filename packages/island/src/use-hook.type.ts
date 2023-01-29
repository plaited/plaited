import { RulesFunc } from '@plaited/plait'
import { Query } from './base-element.js'

export type UseHook<T = Record<string, unknown>> = (args: {
  $: Query
} & T) => {
  actions: Record<string, (payload: unknown) => void>,
  strands: Record<string, RulesFunc>
}
