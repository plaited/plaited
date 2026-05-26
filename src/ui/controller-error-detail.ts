import { type JsonObject, JsonObjectSchema } from '../behavioral.ts'
import type { ControllerErrorMessage } from '../shared/shared.schemas.ts'
import { isTypeOf } from '../utils.ts'

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
  description,
  context,
}: {
  error: unknown
  description?: string
  context?: JsonObject
}): Omit<ControllerErrorMessage['detail'], 'topic' | 'version'> => {
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
  const normalizedDescription =
    description ??
    (errorRecord && isTypeOf<string>(errorRecord.description, 'string') && errorRecord.description.length > 0
      ? errorRecord.description
      : undefined)
  return {
    message,
    description: normalizedDescription,
    context: Object.keys(mergedContext).length > 0 ? mergedContext : undefined,
  }
}
