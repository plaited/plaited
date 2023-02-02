import { formatList } from './format-list.ts'
import { DesignTokenGroup, GetFormatters } from '../token-types.ts'
import { postcss, PostCSSPlugin } from '../deps.ts'
import combineSelectors from './combine-duplicate-selectors.js'
export const transformCssTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
  formatters,
}: {
  tokens: DesignTokenGroup
  outputDirectory: string
  baseFontSize: number
  formatters: GetFormatters
}) => {
  await Deno.mkdir(outputDirectory, { recursive: true })
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters,
  })
  const { css } = await postcss([
    combineSelectors as unknown as PostCSSPlugin,
  ]).process(content, { from: undefined, to: '' })
  await Deno.writeTextFile(`${outputDirectory}/tokens.css`, css)
}
