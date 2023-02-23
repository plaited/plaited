import { formatList } from './format-list.ts'
import { DesignTokenGroup, GetFormatters } from '../token-types.ts'
import { combineDuplicatedSelectors, postcss } from '../deps.ts'

export const transformCssTokens = async ({
  tokens,
  output,
  baseFontSize,
  formatters,
}: {
  tokens: DesignTokenGroup
  output: string
  baseFontSize: number
  formatters: GetFormatters
}) => {
  await Deno.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters,
  })
  const { css } = await postcss([
    combineDuplicatedSelectors,
  ]).process(content, { from: undefined, to: '' })
  await Deno.writeTextFile(`${output}/tokens.css`, css)
}
