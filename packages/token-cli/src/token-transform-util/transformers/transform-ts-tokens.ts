import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { tsTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'

export const transformTsTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  baseFontSize: number
}) => {
  const output = `${outputDirectory}/ts-tokens`
  await fs.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    baseFontSize,
    formatters: tsTokens,
  })
  await fs.writeFile(`${output}/tokens.ts`,  content)
}
