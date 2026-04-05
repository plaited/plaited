import type { infer as Infer, ZodTypeAny } from 'zod'
import type { Disconnect, Trigger } from '../behavioral.ts'
import { isTypeOf } from '../utils.ts'
import type { Listen, SchemaViolationHandler, Signal } from './agent.types.ts'

/**
 * Creates a schema-validated reactive signal.
 *
 * @template TSchema - Zod schema used to validate stored values.
 * @param options - Signal configuration and runtime integration hooks.
 * @returns Mutable signal with schema-aware `get`, `set`, and `listen` methods.
 *
 * @public
 */
export const useSignal = <TSchema extends ZodTypeAny = ZodTypeAny>({
  key,
  schema,
  value,
  onSchemaViolation,
  disconnectSet,
  trigger,
}: {
  key: string
  schema: TSchema
  value?: Infer<TSchema>
  onSchemaViolation?: SchemaViolationHandler<TSchema>
  disconnectSet: Set<Disconnect>
  trigger: Trigger
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

  const listen: Listen = (eventType, getLVC) => {
    const cb = (detail?: Infer<TSchema>) =>
      isTypeOf<string>(eventType, 'string') ? trigger({ type: eventType, detail }) : eventType()
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
