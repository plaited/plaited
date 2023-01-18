import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { cssTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'
import { minify } from 'csso'

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
  const { css } = minify(content)
  await fs.writeFile(`${outputDirectory}/tokens.css`, css)
}
