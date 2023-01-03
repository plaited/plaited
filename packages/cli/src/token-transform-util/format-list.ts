/* eslint-disable no-return-assign */
import { trueTypeOf }from '@plaited/utils'
import { DesignTokenGroup, DesignToken, FormatterObject } from '../types.js'

export const formatList = ({
  tokens,
  tokenPath = [],
  prefix = '',
  formatters,
  allTokens,
}: {
  tokens: DesignTokenGroup
  tokenPath?: string[]
  prefix: string
  formatters: FormatterObject
  allTokens?: DesignTokenGroup
}) => {
  const _allTokens = tokens || allTokens
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (tokens.hasOwnProperty('$value')) {
    const { $value, $type } = tokens as unknown as DesignToken
    string += formatters[$type]({ tokenPath, $value, prefix, _allTokens })
  }
  else {
    for(const name in tokens) {
      if(tokens.hasOwnProperty(name)) {
        string += formatList({
          prefix,
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
