import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { cssTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'

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
  await fs.writeFile(`${output}/tokens.css`, [ ':root{\n', content, '}' ].join(''))
}
