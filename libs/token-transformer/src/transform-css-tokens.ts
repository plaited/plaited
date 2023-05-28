import { mkdir } from 'node:fs/promises'
import { DesignTokenGroup, GetFormatters } from '@plaited/token-types'
import { formatList } from './format-list.js'
const reduceWhitespace = (str: string) => str.replace(/(\s\s+|\n)/g, ' ')

const deduplicate = (css: string) => {
  const regex = /([^{\n]*)\{(\s*[\s\S]*?\s*)\}/gm
  const map = new Map<string, Set<string>>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(css)) !== null) {
    const selector = match[1]
    const rule = reduceWhitespace(match[2])
    const set = map.get(selector)
    if (set) {
      set.add(rule)
      continue
    }
    map.set(selector, new Set<string>([ rule ]))
  }
  return [ ...map ].flatMap(([ key, val ]) => {
    return [ key, '{', ...val, '}' ]
  }).join('')
}

export const transformCssTokens = async ({
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
  deduplicate(content)
  await Bun.write(`${output}/tokens.css`, deduplicate(content))
}
