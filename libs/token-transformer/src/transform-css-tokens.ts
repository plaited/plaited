import { TransformerParams } from './types.js'
import { defaultCSSFormatters } from './css-tokens/index.js'
import { formatList } from './format-list.js'
import { defaultBaseFontSize } from './constants.js'
const reduceWhitespace = (str: string) => str.replace(/(\s\s+|\n)/g, ' ')

const deduplicate = (css: string) => {
  const regex = /((?:.*:host|:host\([^)]*\))[^{\n]*)\{(\s*[\s\S]*?\s*)\}/gm
  const map = new Map<string, Set<string>>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(css)) !== null) {
    const selector = match[1]
    const rule = reduceWhitespace(match[2])
    const set = map.get(selector)
    if (set) {
      set.add(rule)
      continue
    }
    map.set(selector, new Set<string>([ rule ]))
  }
  return [ ...map ].flatMap(([ key, val ]) => {
    return [ key, '{', ...val, key.startsWith('@') ? '}}' : '}' ]
  }).join('')
}

export const transformCssTokens = ({
  tokens,
  baseFontSize = defaultBaseFontSize,
  formatters = defaultCSSFormatters,
  mediaQueries,
  colorSchemes,
  containerQueries,
}: TransformerParams) => {
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters,
    mediaQueries,
    colorSchemes,
    containerQueries,
  })
  return deduplicate(content)
}
