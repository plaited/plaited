import type { TransformerParams } from './token.types.js'
import { getFormatters } from './formatters/css-formatters.js'
import { formatList } from './formatters/format-list.js'

const deduplicate = (css: string) => {
  const regex = /((?:.*:host|:host\([^)]*\))[^{\n]*)\{(\s*[\s\S]*?\s*)\}/gm
  const map = new Map<string, Set<string>>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(css)) !== null) {
    const selector = match[1]
    const rule = match[2].replace(/(\s\s+|\n)/g, ' ')
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
export const transformToCSS = ({
  tokens,
  contexts: { mediaQueries = {}, colorSchemes = {} } = {},
}: TransformerParams) => {
  const content = formatList({
    tokens,
    allTokens: tokens,
    getFormatters,
    contexts: {
      colorSchemes,
      mediaQueries,
    },
  })
  return deduplicate(content)
}
