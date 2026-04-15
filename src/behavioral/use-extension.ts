import { isTypeOf, trueTypeOf } from '../utils.ts'
import { EXTENSION_FUNCTION_IDENTIFIER } from './behavioral.constants.ts'
import type { DefaultHandlers, Extension, ExtensionParams } from './behavioral.types.ts'

export const useExtension = (id: string, callback: (params: ExtensionParams) => DefaultHandlers): Extension =>
  Object.assign(callback, {
    id,
    $: EXTENSION_FUNCTION_IDENTIFIER,
  })

export const isExtension = (value: unknown): value is Extension => {
  if (trueTypeOf(value) !== 'function') return false
  const candidate = value as { id?: unknown; $?: unknown }
  return isTypeOf<string>(candidate?.id, 'string') && candidate?.$ === EXTENSION_FUNCTION_IDENTIFIER
}
