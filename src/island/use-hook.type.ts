import { RulesFunc } from '../plait.ts'
import { Query } from './island.ts'

export type UseHook<T = Record<string, unknown>> = (
  args: {
    $: Query
  } & T,
) => {
  actions: Record<string, (payload: unknown) => void>
  strands: Record<string, RulesFunc>
}
