import { TransformerParams } from './types.js'
import { formatList } from './format-list.js'
import { defaultTSFormatters } from './ts-tokens/index.js'
import { defaultBaseFontSize } from './constants.js'

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
