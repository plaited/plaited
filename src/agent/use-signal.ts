import type { infer as Infer, ZodTypeAny } from 'zod'

import type { Listen, SchemaViolationHandler, Signal } from './agent.types.ts'

export const useSignal = <TSchema extends ZodTypeAny = ZodTypeAny>({
  key,
  schema,
  value,
  onSchemaViolation,
}: {
  key: string
  schema: TSchema
  value?: Infer<TSchema>
  onSchemaViolation?: SchemaViolationHandler<TSchema>
}): Signal<TSchema> => {
  let store: Infer<TSchema> | undefined = value
  const listeners = new Set<(value?: Infer<TSchema>) => void>()

  const get = () => store

  const set = (value?: Infer<TSchema>) => {
    const parsed = schema.safeParse(value)
    if (!parsed.success) {
      onSchemaViolation?.({
        key,
        schema,
        value,
        violation: parsed,
      })
      return
    }

    store = parsed.data
    for (const cb of listeners) cb(parsed.data)
  }

  const listen: Listen = ({ eventType, trigger, getLVC, disconnectSet }) => {
    const cb = (detail?: Infer<TSchema>) => trigger({ type: eventType, detail })
    if (getLVC) cb(store)
    listeners.add(cb)

    const disconnect = () => {
      listeners.delete(cb)
    }

    disconnectSet.add(disconnect)
    return disconnect
  }

  return {
    get,
    set,
    listen,
    schema,
  }
}
