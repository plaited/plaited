import { RULES_FUNCTION_IDENTIFIER } from './behavioral.constants.ts'
import type { DefaultHandlers, Extension, ExtensionParams } from './behavioral.types.ts'

export const useExtension = (id: string, callback: (params: ExtensionParams) => DefaultHandlers): Extension =>
  Object.assign(callback, {
    id,
    $: RULES_FUNCTION_IDENTIFIER,
  })
