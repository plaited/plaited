/* eslint-disable no-return-assign */
import { trueTypeOf }from '@plaited/utils'
import { DesignTokenGroup, DesignToken, GetFormatter } from '../types.js'

export const formatList = ({
  tokens,
  tokenPath = [],
  formatters,
  allTokens,
  baseFontSize,
}: {
  tokens: DesignTokenGroup
  tokenPath?: string[]
  formatters: GetFormatter
  allTokens?: DesignTokenGroup
  baseFontSize: number
}) => {
  const _allTokens = tokens || allTokens
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (tokens.hasOwnProperty('$value')) {
    const { $value, $type } = tokens as unknown as DesignToken
    string += formatters({ tokenPath, $value, _allTokens, baseFontSize, $type })
  }
  else {
    for(const name in tokens) {
      if(tokens.hasOwnProperty(name)) {
        string += formatList({
          baseFontSize,
          tokens: tokens[name] as DesignTokenGroup,
          tokenPath: [ ...tokenPath, name ],
          formatters,
          allTokens: _allTokens,
        })
      }
    }
  }
  return string
}
