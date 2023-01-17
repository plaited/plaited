import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { jsRaw } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'

export const transformJsRaw = async ({
  tokens,
  outputDirectory,
  baseFontSize,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  baseFontSize: number
}) => {
  const output = `${outputDirectory}/js-raw`
  await fs.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    baseFontSize,
    formatters: jsRaw,
  })
  await fs.writeFile(`${output}/tokens.js`,  content)
}
