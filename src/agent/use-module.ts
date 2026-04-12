import * as z from 'zod'
import type { BPEvent, BPListener } from '../behavioral.ts'
import { bSync, bThread } from '../behavioral.ts'
import type { Module, ModuleParams } from './agent.types.ts'

export const MODULE_NAME_METADATA_KEY = '__plaitedModuleName' as const

type ModuleWithNameMetadata = Module & {
  [MODULE_NAME_METADATA_KEY]?: string
}

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
    on: (sourceSchema = AnySourceSchema): BPListener => ({
      type,
      sourceSchema,
      detailSchema,
    }),
    request: (...args: EventRefRequestArgs<TDetail>): BPEvent => {
      const detail = detailSchema.parse((args as [TDetail | undefined])[0])
      return detail === undefined ? { type } : { type, detail }
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
    return callback({
      ...params,
      local,
      external,
      bSync,
      bThread,
    })
  }
  if (declaredModuleName.length > 0) {
    ;(wrapped as ModuleWithNameMetadata)[MODULE_NAME_METADATA_KEY] = declaredModuleName
  }
  return wrapped
}
