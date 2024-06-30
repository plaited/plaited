import { FormatList, DesignToken, DesignTokenGroup } from '../types.js'
import { trueTypeOf } from '@plaited/utils'

export const formatList: FormatList = ({ tokens, tokenPath = [], getFormatters, allTokens, contexts }) => {
  let string = ''
  if (trueTypeOf(tokens) !== 'object') {
    return string
  }
  if (Object.hasOwn(tokens, '$value')) {
    const token = tokens as unknown as DesignToken
    const formattedValue = getFormatters(token, {
      tokenPath,
      allTokens,
      contexts,
    })
    string += formattedValue ? `${formattedValue}\n` : ''
  } else {
    for (const name in tokens) {
      if (Object.hasOwn(tokens, name)) {
        string += formatList({
          tokens: tokens[name] as DesignTokenGroup,
          tokenPath: [...tokenPath, name],
          getFormatters,
          allTokens,
          contexts,
        })
      }
    }
  }
  return string
}
