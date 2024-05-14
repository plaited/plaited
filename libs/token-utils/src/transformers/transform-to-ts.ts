import { TransformerParams } from '../types.js'
import { formatList } from './format-list.js'
import { getFormatters } from '../formatters/ts-formatters.js'

/**
 * Transforms design tokens into a mapping to css custom properties references to be used
 * inline styles in ts/js component files.
 * @param {TransformerParams} params - The parameters for the transformation.
 * @returns {string} The transformed js variables.
 */
export const transformToTS = ({ tokens, contexts }: TransformerParams) => {
  const content = formatList({
    tokens,
    allTokens: tokens,
    getFormatters,
    contexts,
  })
  return content
}
