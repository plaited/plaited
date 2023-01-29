import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { cssTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../../types.js'
import { minify } from 'csso'
import postcss from'postcss'
import combine from 'postcss-combine-duplicated-selectors'
export const transformCssTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  baseFontSize: number
}) => {
  await fs.mkdir(outputDirectory, { recursive: true })
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters: cssTokens,
  })
  const { css } = await postcss([
    combine,
  ]).process(content, { from: undefined, to: '' })
  await fs.writeFile(`${outputDirectory}/tokens.css`, minify(css).css)
}
