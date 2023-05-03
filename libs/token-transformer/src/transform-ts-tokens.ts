import { mkdir } from 'node:fs/promises'
import { formatList } from './format-list.js'
import { DesignTokenGroup, GetFormatters } from '@plaited/token-types'

export const transformTsTokens = async ({
  tokens,
  output,
  baseFontSize,
  formatters,
}: {
  tokens: DesignTokenGroup;
  output: string;
  baseFontSize: number;
  formatters: GetFormatters;
}) => {
  await mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters,
  })
  await Bun.write(`${output}/tokens.ts`, content)
}
