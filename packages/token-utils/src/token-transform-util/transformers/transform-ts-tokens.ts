import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { tsTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../../types.js'

export const transformTsTokens = async ({
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
    formatters: tsTokens,
  })
  await fs.writeFile(`${outputDirectory}/tokens.ts`, content)
}
