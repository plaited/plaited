import { TransformerParams } from './types.js'
import { defaultCSSFormatters } from './css-tokens/index.js'
import { formatList } from './format-list.js'
import { defaultBaseFontSize } from './constants.js'
import { reduceWhitespace } from '@plaited/utils'

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
    map.set(selector, new Set<string>([rule]))
  }
  return [...map]
    .flatMap(([key, val]) => {
      return [key, '{', ...val, key.startsWith('@') ? '}}' : '}']
    })
    .join('')
}

/**
 * Transforms design tokens into CSS rules with deduplicated selectors on :host.
 * These rules are to be used with design token custom element and applied to
 * it's shadow root's constructable stylesheet.
 * @param {TransformerParams} params - The parameters for the transformation.
 * @returns {string} The transformed CSS rules with deduplicated selectors.
 */
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
