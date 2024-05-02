import { GetFormatters } from '../types.js'
import { border } from './css/border.js'
import { color } from './css/color.js'
import { dimension } from './css/dimension.js'
import { fontFamily } from './css/font-family.js'
import { gradient } from './css/gradient.js'
import { defaultFormat } from './css/default-format.js'
import { dropShadow } from './css/drop-shadow.js'
import { transition } from './css/transition.js'
import { composite } from './css/composite.js'
import { gridTemplate } from './css/grid-template.js'
import { gap } from './css/gap.js'

/**
 * This formatter object will return formatters that will create content for an
 * optimized css stylesheet of css custom properties to be applied to
 */
export const getFormatters: GetFormatters = (token, details) => {
  switch (token.$type) {
    case 'dimension':
    case 'lineHeight':
    case 'letterSpacing':
    case 'fontSize':
      return dimension(token, details)
    case 'color':
      return color(token, details)
    case 'border':
      return border(token, details)
    case 'dropShadow':
      return dropShadow(token, details)
    case 'gradient':
      return gradient(token, details)
    case 'fontFamily':
      return fontFamily(token, details)
    case 'transition':
      return transition(token, details)
    case 'gap':
      return gap(token, details)
    case 'gridTemplate':
      return gridTemplate(token, details)
    case 'typography':
    case 'grid':
    case 'flex':
      return composite()
    default:
      return defaultFormat(token, details)
  }
}
