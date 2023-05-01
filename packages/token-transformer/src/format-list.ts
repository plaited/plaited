/* eslint-disable no-return-assign */
import { trueTypeOf } from '@plaited/utils'
import { DesignToken, DesignTokenGroup, GetFormatters } from '@plaited/token-types'

export const formatList = ({
  tokens,
  tokenPath = [],
  formatters,
  allTokens,
  baseFontSize,
}: {
  tokens: DesignTokenGroup;
  allTokens: DesignTokenGroup;
  tokenPath?: string[];
  formatters: GetFormatters;
  baseFontSize: number;
}) => {
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (Object.hasOwn(tokens, '$value')) {
    const { $value, $type } = tokens as unknown as DesignToken
    const formattedValue = formatters({
      tokenPath,
      $value,
      allTokens,
      baseFontSize,
      $type,
    })
    string += formattedValue ? `${formattedValue}\n` : ''
  } else {
    for (const name in tokens) {
      if (Object.hasOwn(tokens, name)) {
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