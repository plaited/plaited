import { formatList } from './format-list.ts'
import { tsTokens } from './ts-tokens/mod.ts'
import { DesignTokenGroup } from '../token-types.ts'

export const transformTsTokens = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup
  outputDirectory: string
  baseFontSize: number
}) => {
  await Deno.mkdir(outputDirectory, { recursive: true })
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters: tsTokens,
  })
  await Deno.writeTextFile(`${outputDirectory}/tokens.ts`, content)
}
