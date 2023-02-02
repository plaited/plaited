import { formatList } from './format-list.ts'
import { DesignTokenGroup, GetFormatters } from '../token-types.ts'

export const transformTsTokens = async ({
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
  await Deno.writeTextFile(`${outputDirectory}/tokens.ts`, content)
}
