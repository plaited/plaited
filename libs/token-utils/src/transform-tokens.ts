import { transformToCSS } from './transformers/transform-to-css.js'
import { transformToTS } from './transformers/transform-to-ts.js'
import { TransformTokensParams } from './types.js'

export const transformTokens = ({
  tokens,
  contexts: { mediaQueries = {}, colorSchemes = {} } = {},
}: TransformTokensParams): {
  css: string
  ts: string
} => ({
  css: transformToCSS({
    tokens,
    contexts: {
      colorSchemes,
      mediaQueries,
    },
  }),
  ts: transformToTS({
    tokens,
    contexts: {
      colorSchemes,
      mediaQueries,
    },
  }),
})
