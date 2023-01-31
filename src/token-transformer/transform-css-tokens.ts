import { formatList } from './format-list.ts'
import { cssTokens } from './css-tokens/mod.ts'
import { DesignTokenGroup } from '../token-types.ts'
import { combineSelectors, postcss, PostCSSPlugin } from '../deps.ts'
export const transformCssTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup
  outputDirectory: string
  baseFontSize: number
}) => {
  await Deno.mkdir(outputDirectory, { recursive: true })
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters: cssTokens,
  })
  const { css } = await postcss([
    combineSelectors as unknown as PostCSSPlugin,
  ]).process(content, { from: undefined, to: '' })
  await Deno.writeTextFile(`${outputDirectory}/tokens.css`, css)
}
