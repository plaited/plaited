import { type JsonObject, JsonObjectSchema } from '../behavioral.ts'
import { isTypeOf } from '../utils.ts'
import type { ControllerErrorDetail } from './controller.schemas.ts'

const stringifyUnknown = (value: unknown): string => {
  if (isTypeOf<string>(value, 'string')) return value
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const readJsonObject = (value: unknown): JsonObject | undefined => {
  const parsed = JsonObjectSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return isTypeOf<object>(value, 'object') && value !== null
}

export const normalizeControllerErrorDetail = ({
  error,
  kind,
  context,
}: {
  error: unknown
  kind?: string
  context?: JsonObject
}): ControllerErrorDetail => {
  const errorRecord = isRecord(error) ? error : undefined
  const message =
    error instanceof Error
      ? error.message
      : errorRecord && isTypeOf<string>(errorRecord.message, 'string')
        ? errorRecord.message
        : stringifyUnknown(error)
  const mergedContext: JsonObject = {
    ...(errorRecord ? (readJsonObject(errorRecord.context) ?? {}) : {}),
    ...(context ?? {}),
  }
  if (error instanceof Error && error.name !== 'Error' && !('errorName' in mergedContext)) {
    mergedContext.errorName = error.name
  }
  const normalizedKind =
    kind ??
    (errorRecord && isTypeOf<string>(errorRecord.kind, 'string') && errorRecord.kind.length > 0
      ? errorRecord.kind
      : undefined)
  return {
    message,
    kind: normalizedKind,
    context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
  }
}
