/* eslint-disable no-return-assign */
import { trueTypeOf } from '@plaited/utils'
import { DesignToken, DesignTokenGroup } from '@plaited/token-types'
import { FormatList } from './types.js'
export const formatList: FormatList = ({
  tokens,
  tokenPath = [],
  formatters,
  allTokens,
  baseFontSize,
  mediaQueries,
  colorSchemes,
  containerQueries,
}) => {
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (Object.hasOwn(tokens, '$value')) {
    const token = tokens as unknown as DesignToken
    const formattedValue = formatters(token, {
      tokenPath,
      allTokens,
      baseFontSize,
      mediaQueries,
      colorSchemes,
      containerQueries,
    })
    string += formattedValue ? `${formattedValue}\n` : ''
  } else {
    for (const name in tokens) {
      if (Object.hasOwn(tokens, name)) {
        string += formatList({
          baseFontSize,
          tokens: tokens[name] as DesignTokenGroup,
          tokenPath: [...tokenPath, name],
          formatters,
          allTokens,
          mediaQueries,
          colorSchemes,
          containerQueries,
        })
      }
    }
  }
  return string
}
