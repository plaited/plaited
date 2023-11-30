import { TransformerParams } from './types.js'
import { formatList } from './format-list.js'
import { defaultTSFormatters } from './ts-tokens/index.js'
import { defaultBaseFontSize } from './constants.js'

/**
 * Transforms design tokens into a mapping to css custom properties references to be used
 * inline styles in ts/js component files.
 * @param {TransformerParams} params - The parameters for the transformation.
 * @returns {string} The transformed js variables.
 */
export const transformTsTokens = ({
  tokens,
  baseFontSize = defaultBaseFontSize,
  formatters = defaultTSFormatters,
  mediaQueries,
  colorSchemes,
  containerQueries,
}: TransformerParams) =>
  formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters,
    mediaQueries,
    colorSchemes,
    containerQueries,
  })
