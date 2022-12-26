import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { jsRaw } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'

export const transformJsRaw = async ({
  tokens,
  outputDirectory,
  prefix,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  prefix: string
}) => {
  const output = `${outputDirectory}/js-raw`
  await fs.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    prefix,
    formatters: jsRaw,
  })
  await fs.writeFile(`${output}/tokens.js`,  content)
}
