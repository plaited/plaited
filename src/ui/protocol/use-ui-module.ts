import * as z from 'zod'

import type { AddBThreads, BPEvent, BPListener, DefaultHandlers, Trigger, UseSnapshot } from '../../behavioral.ts'
import { bSync, bThread } from '../../behavioral.ts'

const UI_MODULE_FACTORY_BRAND = Symbol('plaited.ui.module.factory')
const UI_MODULE_LISTENER_BRAND = Symbol('plaited.ui.module.listener')
const UI_MODULE_EVENT_BRAND = Symbol('plaited.ui.module.event')
const UI_MODULE_RULE_BRAND = Symbol('plaited.ui.module.rule')
const UI_MODULE_LISTENER_GUIDANCE = 'Use local(schema).on(...), external(schema[, moduleName]).on(...), or action(schema).on(...).'
const UI_MODULE_EVENT_GUIDANCE =
  'Use local(schema).request(...), external(schema[, moduleName]).request(...), or action(schema).request(...).'
const UI_MODULE_RULE_GUIDANCE =
  'Use the bSync and bThread helpers from useUIModule callback args when composing UI module threads.'
const UI_MODULE_HANDLER_SCOPE_GUIDANCE =
  'Consume external/action events via threads, request local(schema).request(...), and run side effects from local handlers.'
const UI_MODULE_TRIGGER_SOURCE = z.literal('trigger')
const UI_MODULE_ANY_SOURCE = z.enum(['trigger', 'request', 'emit'])

type UIModuleEventSource = z.infer<typeof UI_MODULE_ANY_SOURCE>
type SchemaDetail<TSchema extends z.ZodTypeAny> = z.infer<TSchema> extends { detail?: infer TDetail } ? TDetail : never
type EventRefRequestArgs<TDetail> = undefined extends TDetail ? [detail?: TDetail] : [detail: TDetail]
type UIModuleRule = ReturnType<typeof bSync>
type BrandedUIModuleListener = BPListener & {
  [UI_MODULE_LISTENER_BRAND]: true
}
type BrandedUIModuleEvent = BPEvent & {
  [UI_MODULE_EVENT_BRAND]: true
}
type BrandedUIModuleRule = UIModuleRule & {
  [UI_MODULE_RULE_BRAND]: true
}
type UIModuleHandlers = NonNullable<UIModuleResult['handlers']>
type ScopedThreads = Record<string, UIModuleRule>

export type UIModuleEventRef<TDetail> = {
  type: string
  on: (sourceSchema?: z.ZodType<UIModuleEventSource>) => BPListener
  request: (...args: EventRefRequestArgs<TDetail>) => BPEvent
}

export type UIModuleInstallParams = {
  moduleId: string
  emit: Trigger
  addThreads: AddBThreads
  useSnapshot: UseSnapshot
}

export type UIModuleResult = {
  threads?: Record<string, ReturnType<typeof bSync>>
  handlers?: DefaultHandlers
  actions?: string[]
}

type UseUIModuleHelpers = UIModuleInstallParams & {
  local: <TSchema extends z.ZodTypeAny>(schema: TSchema) => UIModuleEventRef<SchemaDetail<TSchema>>
  external: <TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    moduleName?: string,
  ) => UIModuleEventRef<SchemaDetail<TSchema>>
  action: <TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    moduleName?: string,
  ) => UIModuleEventRef<SchemaDetail<TSchema>>
  bSync: typeof bSync
  bThread: typeof bThread
}

// UI module install params intentionally do not include last(listener):
// the UI runtime does not currently maintain context memory for replay-safe reads.

type UseUIModuleCallback = (args: UseUIModuleHelpers) => Omit<UIModuleResult, 'actions'>

export type UIModule = ((params: UIModuleInstallParams) => UIModuleResult) & {
  [UI_MODULE_FACTORY_BRAND]: true
}

const toScopedType = ({ scope, type }: { scope: string; type: string }) => `${scope}:${type}`
const toScopedThreadLabel = ({ scope, label }: { scope: string; label: string }) =>
  label.startsWith(`${scope}:`) ? label : `${scope}:${label}`
const isBrandedUIModuleListener = (value: unknown): value is BrandedUIModuleListener =>
  typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[UI_MODULE_LISTENER_BRAND] === true
const isBrandedUIModuleEvent = (value: unknown): value is BrandedUIModuleEvent =>
  typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[UI_MODULE_EVENT_BRAND] === true
const isBrandedUIModuleRule = (value: unknown): value is BrandedUIModuleRule =>
  typeof value === 'function' && (value as unknown as Record<PropertyKey, unknown>)[UI_MODULE_RULE_BRAND] === true
const brandListener = (listener: BPListener): BPListener => {
  Object.defineProperty(listener, UI_MODULE_LISTENER_BRAND, {
    value: true,
    enumerable: false,
  })
  return listener
}
const brandEvent = (event: BPEvent): BPEvent => {
  Object.defineProperty(event, UI_MODULE_EVENT_BRAND, {
    value: true,
    enumerable: false,
  })
  return event
}
const brandRule = <TRule extends UIModuleRule>(rule: TRule): TRule => {
  Object.defineProperty(rule, UI_MODULE_RULE_BRAND, {
    value: true,
    enumerable: false,
  })
  return rule
}
const assertBrandedListeners = ({
  listeners,
  field,
}: {
  listeners: unknown
  field: 'waitFor' | 'block' | 'interrupt'
}): void => {
  if (listeners === undefined) return
  const items = Array.isArray(listeners) ? listeners : [listeners]
  for (const [index, listener] of items.entries()) {
    if (isBrandedUIModuleListener(listener)) continue
    const pointer = Array.isArray(listeners) ? `${field}[${index}]` : field
    throw new TypeError(`useUIModule bSync(${pointer}) requires UI module event refs. ${UI_MODULE_LISTENER_GUIDANCE}`)
  }
}
const assertBrandedRequest = (request: unknown): void => {
  if (request === undefined) return
  if (isBrandedUIModuleEvent(request)) return
  throw new TypeError(`useUIModule bSync(request) requires UI module event refs. ${UI_MODULE_EVENT_GUIDANCE}`)
}
const assertBrandedEmitEvent = (event: unknown): void => {
  if (isBrandedUIModuleEvent(event)) return
  throw new TypeError(`useUIModule emit(event) requires UI module event refs. ${UI_MODULE_EVENT_GUIDANCE}`)
}
const assertBrandedRule = ({ rule, pointer }: { rule: unknown; pointer: string }): void => {
  if (isBrandedUIModuleRule(rule)) return
  throw new TypeError(`useUIModule ${pointer} must be authored with UI module helpers. ${UI_MODULE_RULE_GUIDANCE}`)
}
const assertBrandedThreads = ({ threads, pointer }: { threads: ScopedThreads; pointer: string }): void => {
  for (const [label, thread] of Object.entries(threads)) {
    assertBrandedRule({ rule: thread, pointer: `${pointer}[${JSON.stringify(label)}]` })
  }
}
const normalizeHandlers = ({ handlers, scope }: { handlers: UIModuleHandlers; scope: string }): UIModuleHandlers => {
  const normalized: UIModuleHandlers = {}
  const rawByNormalized = new Map<string, string>()

  for (const [rawKey, handler] of Object.entries(handlers)) {
    const normalizedKey = rawKey.startsWith(`${scope}:`)
      ? rawKey
      : rawKey.includes(':')
        ? (() => {
            throw new TypeError(
              `useUIModule handlers cannot target "${rawKey}" outside module scope "${scope}". ${UI_MODULE_HANDLER_SCOPE_GUIDANCE}`,
            )
          })()
        : toScopedType({ scope, type: rawKey })

    const existingRawKey = rawByNormalized.get(normalizedKey)
    if (existingRawKey) {
      throw new TypeError(
        `useUIModule handlers resolve duplicate key "${normalizedKey}" from "${existingRawKey}" and "${rawKey}".`,
      )
    }
    rawByNormalized.set(normalizedKey, rawKey)
    normalized[normalizedKey] = handler
  }

  return normalized
}

const resolveEventSchema = (schema: z.ZodTypeAny): { type: string; detailSchema: z.ZodType<unknown> } => {
  if (!(schema instanceof z.ZodObject)) {
    throw new TypeError('useUIModule event helpers require a z.object({ type: z.literal(...), detail: ... }) schema')
  }
  const shape = schema.shape as z.ZodRawShape
  const typeSchema = shape.type
  if (!(typeSchema instanceof z.ZodLiteral) || typeof typeSchema.value !== 'string') {
    throw new TypeError('useUIModule event schemas must define type as z.literal("event_type")')
  }
  const detailSchema = shape.detail
  if (!detailSchema) {
    throw new TypeError(
      'useUIModule event schemas must include a detail schema (use z.undefined() for detail-less events)',
    )
  }
  return { type: typeSchema.value, detailSchema: detailSchema as z.ZodType<unknown> }
}

const createEventRef = <TDetail>({
  type,
  detailSchema,
  defaultSourceSchema,
}: {
  type: string
  detailSchema: z.ZodType<TDetail>
  defaultSourceSchema: z.ZodType<UIModuleEventSource>
}): UIModuleEventRef<TDetail> => {
  return {
    type,
    on: (sourceSchema = defaultSourceSchema): BPListener =>
      brandListener({
        type,
        sourceSchema,
        detailSchema,
      }),
    request: (...args: EventRefRequestArgs<TDetail>): BPEvent => {
      const detail = detailSchema.parse((args as [TDetail | undefined])[0])
      return brandEvent(detail === undefined ? { type } : { type, detail })
    },
  }
}

const scopeThreads = ({ threads, scope }: { threads: ScopedThreads; scope: string }): ScopedThreads => {
  const scoped: ScopedThreads = {}
  for (const [label, thread] of Object.entries(threads)) {
    scoped[toScopedThreadLabel({ scope, label })] = thread
  }
  return scoped
}

export const isUIModule = (value: unknown): value is UIModule => {
  return typeof value === 'function' && (value as unknown as Record<PropertyKey, unknown>)[UI_MODULE_FACTORY_BRAND] === true
}

export const useUIModule = (moduleName: string, callback: UseUIModuleCallback): UIModule => {
  const declaredModuleName = moduleName.trim()
  const wrapped = ((params: UIModuleInstallParams): UIModuleResult => {
    const scope = declaredModuleName || params.moduleId
    const declaredActionTypes = new Set<string>()

    const wrappedBSync: typeof bSync = (syncPoint) => {
      assertBrandedListeners({ listeners: syncPoint.waitFor, field: 'waitFor' })
      assertBrandedListeners({ listeners: syncPoint.block, field: 'block' })
      assertBrandedListeners({ listeners: syncPoint.interrupt, field: 'interrupt' })
      assertBrandedRequest(syncPoint.request)
      return brandRule(bSync(syncPoint))
    }
    const wrappedBThread: typeof bThread = (rules, repeat) => {
      for (const [index, rule] of rules.entries()) {
        assertBrandedRule({ rule, pointer: `bThread(rules[${index}])` })
      }
      return brandRule(bThread(rules, repeat))
    }
    const local = <TSchema extends z.ZodTypeAny>(schema: TSchema): UIModuleEventRef<SchemaDetail<TSchema>> => {
      const event = resolveEventSchema(schema)
      return createEventRef({
        type: toScopedType({ scope, type: event.type }),
        detailSchema: event.detailSchema as z.ZodType<SchemaDetail<TSchema>>,
        defaultSourceSchema: UI_MODULE_ANY_SOURCE,
      })
    }
    const external = <TSchema extends z.ZodTypeAny>(
      schema: TSchema,
      moduleScope?: string,
    ): UIModuleEventRef<SchemaDetail<TSchema>> => {
      const event = resolveEventSchema(schema)
      const externalScope = moduleScope?.trim()
      return createEventRef({
        type: externalScope ? toScopedType({ scope: externalScope, type: event.type }) : event.type,
        detailSchema: event.detailSchema as z.ZodType<SchemaDetail<TSchema>>,
        defaultSourceSchema: UI_MODULE_ANY_SOURCE,
      })
    }
    const action = <TSchema extends z.ZodTypeAny>(
      schema: TSchema,
      moduleScope?: string,
    ): UIModuleEventRef<SchemaDetail<TSchema>> => {
      const ref = external(schema, moduleScope)
      declaredActionTypes.add(ref.type)
      return createEventRef({
        type: ref.type,
        detailSchema: resolveEventSchema(schema).detailSchema as z.ZodType<SchemaDetail<TSchema>>,
        defaultSourceSchema: UI_MODULE_TRIGGER_SOURCE,
      })
    }
    const wrappedEmit: Trigger = (event) => {
      assertBrandedEmitEvent(event)
      params.emit(event)
    }
    const wrappedAddThreads: AddBThreads = (threads) => {
      const typedThreads = threads as ScopedThreads
      assertBrandedThreads({ threads: typedThreads, pointer: 'addThreads(threads)' })
      params.addThreads(scopeThreads({ threads: typedThreads, scope }))
    }

    const moduleResult = callback({
      moduleId: params.moduleId,
      emit: wrappedEmit,
      addThreads: wrappedAddThreads,
      useSnapshot: params.useSnapshot,
      local,
      external,
      action,
      bSync: wrappedBSync,
      bThread: wrappedBThread,
    })

    const normalizedHandlers = moduleResult.handlers
      ? normalizeHandlers({
          handlers: moduleResult.handlers,
          scope,
        })
      : undefined

    const normalizedThreads = moduleResult.threads
      ? (() => {
          const typedThreads = moduleResult.threads as ScopedThreads
          assertBrandedThreads({
            threads: typedThreads,
            pointer: 'return threads',
          })
          return scopeThreads({ threads: typedThreads, scope })
        })()
      : undefined

    return {
      threads: normalizedThreads,
      handlers: normalizedHandlers,
      actions: declaredActionTypes.size > 0 ? [...declaredActionTypes] : undefined,
    }
  }) as UIModule

  Object.defineProperty(wrapped, UI_MODULE_FACTORY_BRAND, {
    value: true,
    enumerable: false,
  })

  return wrapped
}
