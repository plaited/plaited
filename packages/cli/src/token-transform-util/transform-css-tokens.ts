import fs from 'fs/promises'
import { formatList } from './format-list.js'
import { cssTokens } from '../formatters/index.js'
import { DesignTokenGroup } from '../types.js'

export const transformCssTokens = async ({
  tokens,
  outputDirectory,
  prefix,
}: {
  tokens: DesignTokenGroup,
  outputDirectory: string,
  prefix: string
}) => {
  const output = `${outputDirectory}/css-tokens`
  await fs.mkdir(output, { recursive: true })
  const content = formatList({
    tokens,
    prefix,
    formatters: cssTokens,
  })
  await fs.writeFile(`${output}/tokens.css`, [ ':root{\n', content, '}' ].join(''))
}
