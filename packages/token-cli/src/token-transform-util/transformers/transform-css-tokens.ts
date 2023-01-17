import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { cssTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'
import postcss from'postcss'
import discardDuplicates from 'postcss-discard-duplicates' 

export const transformCssTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  baseFontSize: number
}) => {
  const output = `${outputDirectory}/css-tokens`
  await fs.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    baseFontSize,
    formatters: cssTokens,
  })
  const { css } = await postcss([
    discardDuplicates,
  ]).process(content, { from: undefined, to: '' })
  await fs.writeFile(`${output}/tokens.css`, css)
}
