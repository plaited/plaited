import type { TransformerParams } from './token.types.js'
import { formatList } from './formatters/format-list.js'
import { getFormatters } from './formatters/ts-formatters.js'

/**
 * Transforms design tokens into a mapping to css custom properties references to be used
 * inline styles in ts/js component files.
 * @param {TransformerParams} params - The parameters for the transformation.
 * @returns {string} The transformed js variables.
 */
export const transformToTS = ({
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
  return content
}
