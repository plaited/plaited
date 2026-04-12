import * as z from 'zod'
import type { BPEvent, BPListener } from '../behavioral.ts'
import { bSync, bThread } from '../behavioral.ts'
import type { Module, ModuleParams } from './agent.types.ts'

export const MODULE_NAME_METADATA_KEY = '__plaitedModuleName' as const
const MODULE_LISTENER_BRAND = Symbol('plaited.module.listener')
const MODULE_EVENT_BRAND = Symbol('plaited.module.event')
const MODULE_RULE_BRAND = Symbol('plaited.module.rule')
const MODULE_LISTENER_GUIDANCE = 'Use local(schema).on(...) or external(schema[, moduleName]).on(...).'
const MODULE_EVENT_GUIDANCE = 'Use local(schema).request(...) or external(schema[, moduleName]).request(...).'
const MODULE_RULE_GUIDANCE =
  'Use the bSync and bThread helpers from useModule callback args when composing module threads.'
const MODULE_HANDLER_SCOPE_GUIDANCE =
  'Consume external events via bThread waitFor external(schema[, moduleName]).on(...), then request local(schema).request(...), and run side effects from the local handler.'

type ModuleWithNameMetadata = Module & {
  [MODULE_NAME_METADATA_KEY]?: string
}
type BrandedModuleListener = BPListener & {
  [MODULE_LISTENER_BRAND]: true
}
type BrandedModuleEvent = BPEvent & {
  [MODULE_EVENT_BRAND]: true
}
type ModuleRule = ReturnType<typeof bSync>
type BrandedModuleRule = ModuleRule & {
  [MODULE_RULE_BRAND]: true
}
type ModuleHandlers = NonNullable<ReturnType<Module>['handlers']>

type ModuleEventSource = 'trigger' | 'request' | 'emit'
type SchemaDetail<TSchema extends z.ZodTypeAny> = z.infer<TSchema> extends { detail?: infer TDetail } ? TDetail : never
type EventRefRequestArgs<TDetail> = undefined extends TDetail ? [detail?: TDetail] : [detail: TDetail]

export type ModuleEventRef<TDetail> = {
  type: string
  on: (sourceSchema?: z.ZodType<ModuleEventSource>) => BPListener
  request: (...args: EventRefRequestArgs<TDetail>) => BPEvent
}

type UseModuleHelpers = {
  local: <TSchema extends z.ZodTypeAny>(schema: TSchema) => ModuleEventRef<SchemaDetail<TSchema>>
  external: <TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    moduleName?: string,
  ) => ModuleEventRef<SchemaDetail<TSchema>>
  bSync: typeof bSync
  bThread: typeof bThread
}

type UseModuleCallback = (args: ModuleParams & UseModuleHelpers) => ReturnType<Module>

const toLocalType = ({ moduleName, type }: { moduleName: string; type: string }) => `${moduleName}:${type}`
const AnySourceSchema = z.enum(['trigger', 'request', 'emit'])
const isBrandedModuleListener = (value: unknown): value is BrandedModuleListener =>
  typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[MODULE_LISTENER_BRAND] === true
const isBrandedModuleEvent = (value: unknown): value is BrandedModuleEvent =>
  typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[MODULE_EVENT_BRAND] === true
const isBrandedModuleRule = (value: unknown): value is BrandedModuleRule =>
  typeof value === 'function' && (value as Record<PropertyKey, unknown>)[MODULE_RULE_BRAND] === true
const brandModuleListener = (listener: BPListener): BPListener => {
  Object.defineProperty(listener, MODULE_LISTENER_BRAND, {
    value: true,
    enumerable: false,
  })
  return listener
}
const brandModuleEvent = (event: BPEvent): BPEvent => {
  Object.defineProperty(event, MODULE_EVENT_BRAND, {
    value: true,
    enumerable: false,
  })
  return event
}
const brandModuleRule = <TRule extends ModuleRule>(rule: TRule): TRule => {
  Object.defineProperty(rule, MODULE_RULE_BRAND, {
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
  if (listeners === undefined) {
    return
  }
  const items = Array.isArray(listeners) ? listeners : [listeners]
  for (const [index, listener] of items.entries()) {
    if (isBrandedModuleListener(listener)) {
      continue
    }
    const pointer = Array.isArray(listeners) ? `${field}[${index}]` : field
    throw new TypeError(`useModule bSync(${pointer}) requires module event refs. ${MODULE_LISTENER_GUIDANCE}`)
  }
}
const assertBrandedRequest = (request: unknown): void => {
  if (request === undefined) {
    return
  }
  if (isBrandedModuleEvent(request)) {
    return
  }
  throw new TypeError(`useModule bSync(request) requires module event refs. ${MODULE_EVENT_GUIDANCE}`)
}
const assertBrandedLastListener = (listener: unknown): asserts listener is BrandedModuleListener => {
  if (isBrandedModuleListener(listener)) {
    return
  }
  throw new TypeError(`useModule last(listener) requires module event refs. ${MODULE_LISTENER_GUIDANCE}`)
}
const assertBrandedEmitEvent = (event: unknown): asserts event is BrandedModuleEvent => {
  if (isBrandedModuleEvent(event)) {
    return
  }
  throw new TypeError(`useModule emit(event) requires module event refs. ${MODULE_EVENT_GUIDANCE}`)
}
const assertBrandedRule = ({
  rule,
  pointer,
}: {
  rule: unknown
  pointer: string
}): asserts rule is BrandedModuleRule => {
  if (isBrandedModuleRule(rule)) {
    return
  }
  throw new TypeError(`useModule ${pointer} must be authored with module helpers. ${MODULE_RULE_GUIDANCE}`)
}
const assertBrandedThreads = ({ threads, pointer }: { threads: Record<string, ModuleRule>; pointer: string }): void => {
  for (const [label, thread] of Object.entries(threads)) {
    assertBrandedRule({
      rule: thread,
      pointer: `${pointer}[${JSON.stringify(label)}]`,
    })
  }
}
const normalizeModuleHandlers = ({ handlers, scope }: { handlers: ModuleHandlers; scope: string }): ModuleHandlers => {
  const normalized: ModuleHandlers = {}
  const rawByNormalized = new Map<string, string>()

  for (const [rawKey, handler] of Object.entries(handlers)) {
    const normalizedKey = rawKey.startsWith(`${scope}:`)
      ? rawKey
      : rawKey.includes(':')
        ? (() => {
            throw new TypeError(
              `useModule handlers cannot target "${rawKey}" outside module scope "${scope}". ${MODULE_HANDLER_SCOPE_GUIDANCE}`,
            )
          })()
        : toLocalType({ moduleName: scope, type: rawKey })

    const existingRawKey = rawByNormalized.get(normalizedKey)
    if (existingRawKey) {
      throw new TypeError(
        `useModule handlers resolve duplicate key "${normalizedKey}" from "${existingRawKey}" and "${rawKey}".`,
      )
    }
    rawByNormalized.set(normalizedKey, rawKey)
    normalized[normalizedKey] = handler
  }

  return normalized
}

const resolveEventSchema = (schema: z.ZodTypeAny): { type: string; detailSchema: z.ZodType<unknown> } => {
  if (!(schema instanceof z.ZodObject)) {
    throw new TypeError('useModule event helpers require a z.object({ type: z.literal(...), detail: ... }) schema')
  }
  const shape = schema.shape as z.ZodRawShape
  const typeSchema = shape.type
  if (!(typeSchema instanceof z.ZodLiteral) || typeof typeSchema.value !== 'string') {
    throw new TypeError('useModule event schemas must define type as z.literal("event_type")')
  }
  const detailSchema = shape.detail
  if (!detailSchema) {
    throw new TypeError(
      'useModule event schemas must include a detail schema (use z.undefined() for detail-less events)',
    )
  }
  return { type: typeSchema.value, detailSchema: detailSchema as z.ZodType<unknown> }
}

const createEventRef = <TDetail>({
  type,
  detailSchema,
}: {
  type: string
  detailSchema: z.ZodType<TDetail>
}): ModuleEventRef<TDetail> => {
  return {
    type,
    on: (sourceSchema = AnySourceSchema): BPListener =>
      brandModuleListener({
        type,
        sourceSchema,
        detailSchema,
      }),
    request: (...args: EventRefRequestArgs<TDetail>): BPEvent => {
      const detail = detailSchema.parse((args as [TDetail | undefined])[0])
      return brandModuleEvent(detail === undefined ? { type } : { type, detail })
    },
  }
}

export const getDeclaredModuleName = (module: Module): string | undefined => {
  const declared = (module as ModuleWithNameMetadata)[MODULE_NAME_METADATA_KEY]
  return typeof declared === 'string' && declared.length > 0 ? declared : undefined
}

export const useModule = (moduleName: string, callback: UseModuleCallback): Module => {
  const declaredModuleName = moduleName.trim()
  const wrapped: Module = (params) => {
    const wrappedBSync: typeof bSync = (syncPoint) => {
      assertBrandedListeners({
        listeners: syncPoint.waitFor,
        field: 'waitFor',
      })
      assertBrandedListeners({
        listeners: syncPoint.block,
        field: 'block',
      })
      assertBrandedListeners({
        listeners: syncPoint.interrupt,
        field: 'interrupt',
      })
      assertBrandedRequest(syncPoint.request)
      return brandModuleRule(bSync(syncPoint))
    }
    const wrappedBThread: typeof bThread = (rules, repeat) => {
      for (const [index, rule] of rules.entries()) {
        assertBrandedRule({
          rule,
          pointer: `bThread(rules[${index}])`,
        })
      }
      return brandModuleRule(bThread(rules, repeat))
    }
    const scope = declaredModuleName || params.moduleId
    const local = <TSchema extends z.ZodTypeAny>(schema: TSchema): ModuleEventRef<SchemaDetail<TSchema>> => {
      const event = resolveEventSchema(schema)
      return createEventRef({
        type: toLocalType({ moduleName: scope, type: event.type }),
        detailSchema: event.detailSchema as z.ZodType<SchemaDetail<TSchema>>,
      })
    }
    const external = <TSchema extends z.ZodTypeAny>(
      schema: TSchema,
      moduleScope?: string,
    ): ModuleEventRef<SchemaDetail<TSchema>> => {
      const event = resolveEventSchema(schema)
      const externalScope = moduleScope?.trim()
      return createEventRef({
        type: externalScope ? toLocalType({ moduleName: externalScope, type: event.type }) : event.type,
        detailSchema: event.detailSchema as z.ZodType<SchemaDetail<TSchema>>,
      })
    }
    const wrappedEmit: ModuleParams['emit'] = (event) => {
      assertBrandedEmitEvent(event)
      params.emit(event)
    }
    const wrappedLast: ModuleParams['last'] = (listener) => {
      assertBrandedLastListener(listener)
      return params.last(listener)
    }
    const wrappedAddThreads: ModuleParams['addThreads'] = (threads) => {
      assertBrandedThreads({
        threads: threads as Record<string, ModuleRule>,
        pointer: 'addThreads(threads)',
      })
      params.addThreads(threads)
    }
    const moduleResult = callback({
      ...params,
      emit: wrappedEmit,
      last: wrappedLast,
      addThreads: wrappedAddThreads,
      local,
      external,
      bSync: wrappedBSync,
      bThread: wrappedBThread,
    })
    const normalizedHandlers = moduleResult.handlers
      ? normalizeModuleHandlers({
          handlers: moduleResult.handlers,
          scope,
        })
      : undefined
    if (moduleResult.threads) {
      assertBrandedThreads({
        threads: moduleResult.threads as Record<string, ModuleRule>,
        pointer: 'return threads',
      })
    }
    return normalizedHandlers
      ? {
          ...moduleResult,
          handlers: normalizedHandlers,
        }
      : moduleResult
  }
  if (declaredModuleName.length > 0) {
    ;(wrapped as ModuleWithNameMetadata)[MODULE_NAME_METADATA_KEY] = declaredModuleName
  }
  return wrapped
}
