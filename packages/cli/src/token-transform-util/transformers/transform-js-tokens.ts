import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { jsTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'

export const transformJsTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  baseFontSize: number
}) => {
  const output = `${outputDirectory}/js-tokens`
  await fs.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    baseFontSize,
    formatters: jsTokens,
  })
  await fs.writeFile(`${output}/tokens.js`,  content)
}
