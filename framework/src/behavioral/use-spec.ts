import * as z from 'zod'
import type { BPListener, Spec, SpecIdioms, BPListenerSchema } from './behavioral.schemas.ts'
import type { Idioms, RulesFunction } from './behavioral.types.ts'
import { sync, thread } from './behavioral.utils.ts'

type SpecListener = z.output<typeof BPListenerSchema>

const specListenerToBPListener = ({ detailSchema, ...listener }: SpecListener): BPListener => ({
  ...listener,
  ...(detailSchema && {
    detailSchema: z.fromJSONSchema(detailSchema) as BPListener['detailSchema'],
  }),
})

const specListenersToBPListeners = (listeners?: SpecListener[]) => {
  return listeners?.map(specListenerToBPListener)
}

const specIdiomsToIdioms = ({ request, waitFor, interrupt, block }: SpecIdioms): Idioms => ({
  ...(request && { request }),
  ...(waitFor && { waitFor: specListenersToBPListeners(waitFor) }),
  ...(interrupt && { interrupt: specListenersToBPListeners(interrupt) }),
  ...(block && { block: specListenersToBPListeners(block) }),
})

export const useSpec = (spec: Spec): [label: string, thread: RulesFunction] => {
  const { once, syncPoints } = spec.thread
  const rules = syncPoints.map((syncPoint) => sync(specIdiomsToIdioms(syncPoint)))
  return [spec.label, thread(rules, once)]
}
