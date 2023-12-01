import { GetFormatters } from '../types.js'
import { defaultFormat } from './default-format.js'
import { composite } from './composite.js'

/**
 * This formatter object will return formatters that will create content for
 * a treeshakeable mapping to css custom properties references to be used
 * inline styles in ts/js component files
 */
export const defaultTSFormatters: GetFormatters = (token, details) => {
  switch (token.$type) {
    case 'typography':
    case 'grid':
    case 'flex':
      return composite(token, details)
    default:
      return defaultFormat(token, details)
  }
}
