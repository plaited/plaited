/* eslint-disable no-return-assign */
import { trueTypeOf }from '@plaited/utils'
import { DesignTokenGroup, DesignToken, FormatterObject } from '../types.js'

export const formatList = ({
  tokens,
  tokenPath = [],
  prefix = '',
  formatters,
}: {
  tokens: DesignTokenGroup
  tokenPath?: string[]
  prefix: string
  formatters: FormatterObject
}) => {
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (tokens.hasOwnProperty('$value')) {
    const { $value, $type } = tokens as unknown as DesignToken
    string += formatters[$type]({ tokenPath, $value, prefix })
  }
  else {
    for(const name in tokens) {
      if(tokens.hasOwnProperty(name)) {
        string += formatList({
          prefix,
          tokens: tokens[name] as DesignTokenGroup,
          tokenPath: [ ...tokenPath, name ],
          formatters,
        })
      }
    }
  }
  return string
}
