/* eslint-disable no-return-assign */
import { trueTypeOf }from '@plaited/utils'
import { DesignTokenGroup, DesignToken, GetFormatter } from '../../types.js'

export const formatList = ({
  tokens,
  tokenPath = [],
  formatters,
  allTokens,
  baseFontSize,
}: {
  tokens: DesignTokenGroup
  allTokens: DesignTokenGroup
  tokenPath?: string[]
  formatters: GetFormatter
  baseFontSize: number
}) => {
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (tokens.hasOwnProperty('$value')) {
    const { $value, $type } = tokens as unknown as DesignToken
    const formattedValue = formatters({ tokenPath, $value, allTokens, baseFontSize, $type })
    string += formattedValue ? `${formattedValue}\n` : ''
  }
  else {
    for(const name in tokens) {
      if(tokens.hasOwnProperty(name)) {
        string += formatList({
          baseFontSize,
          tokens: tokens[name] as DesignTokenGroup,
          tokenPath: [ ...tokenPath, name ],
          formatters,
          allTokens,
        })
      }
    }
  }
  return string
}
