import type { GetFormatters } from './formatters.types.ts'
import { defaultFormat } from './ts/default-format.ts'
import { composite } from './ts/composite.ts'

/**
 * This formatter object will return formatters that will create content for
 * a treeshakeable mapping to css custom properties references to be used
 * inline styles in ts/js component files
 */
export const tsFormatters: GetFormatters = (token, details) => {
  const { $type } = token
  if ($type === 'composite') return composite(token, details)
  return defaultFormat(token, details)
}
