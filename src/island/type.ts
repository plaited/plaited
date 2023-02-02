import { RulesFunc } from '../plait/mod.ts'

export type Query = <T = Element>(id: string) => T[]

export type UseHook<T = Record<string, unknown>> = (
  args: {
    $: Query
  } & T,
) => {
  actions: Record<string, (payload: unknown) => void>
  strands: Record<string, RulesFunc>
}

export type CustomElementTag = `${string}-${string}`