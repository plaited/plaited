import { transformToCSS } from "./transformers/transform-to-css.js";
import { transformToTS } from "./transformers/transform-to-ts.js";
import { TransformTokensParams } from "./types.js";

export const transformTokens = ({
  tokens,
  baseFontSize = 20,
  contexts: { mediaQueries = {}, colorSchemes = {} } = {},
}: TransformTokensParams): {
  css: string;
  ts: string;
} => ({
  css: transformToCSS({
    tokens,
    baseFontSize,
    contexts: {
      colorSchemes,
      mediaQueries,
    },
  }),
  ts: transformToTS({
    tokens,
    baseFontSize,
    contexts: {
      colorSchemes,
      mediaQueries,
    },
  }),
});