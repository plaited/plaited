import type { DesignToken, DesignTokenGroup, DesignValue, MediaValue, Alias } from './token.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { trueTypeOf } from '../utils/true-type-of.js'
import { kebabCase, camelCase } from '../utils/case.js'

export const combineCSSRules = (css: string) => {
  const regex = /((?:.*:host|:host\([^)]*\))[^{\n]*)\{(\s*[\s\S]*?\s*)\}/gm
  const map = new Map<string, Set<string>>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(css)) !== null) {
    const selector = match[1]
    const rule = match[2].replace(/(\s\s+|\n)/g, ' ')
    const set = map.get(selector)
    if (set) {
      set.add(rule)
      continue
    }
    map.set(selector, new Set<string>([rule]))
  }
  return [...map]
    .flatMap(([key, val]) => {
      return [key, '{', ...val, key.startsWith('@') ? '}}' : '}']
    })
    .join('')
}

export const getAliasExportName = (alias: Alias) => {
  const path = matchAlias(alias).split('.')
  return camelCase(path.join(' '))
}

export const getComment = ($value: DesignValue) => `/**\n* @value ${JSON.stringify($value, null, 2)}\n*/`

export const getTokenPath = (value: string) => matchAlias(value).split('.')

export const getProp = (value: string) => {
  const path = matchAlias(value).split('.')
  return kebabCase(path.join(' '))
}

export const convertAliasToCssVar = (alias: Alias, prefix: string) => {
  const tokenPath = matchAlias(alias).split('.')
  return `var(--${prefix}-${kebabCase(tokenPath.join(' '))})` as const
}

export const isDesignToken = (obj: DesignToken | DesignTokenGroup): obj is DesignToken =>
  trueTypeOf(obj) === 'object' && Object.hasOwn(obj, '$value')

export const isMediaValue = ($value: unknown): $value is MediaValue<DesignValue> => {
  return isTypeOf<Record<string, unknown>>($value, 'object') && Object.keys($value).every((key) => key.startsWith('@'))
}

export const matchAlias = (value: string) => value.match(/^(?:\{)([^"]*?)(?:\})$/)?.[1] ?? ''

export const valueIsAlias = (value: unknown): value is Alias => {
  if (isTypeOf<string>(value, 'string')) {
    const match = matchAlias(value)
    return Boolean(match?.[1])
  }
  return false
}

export const formatNonMediaRule = (cssVar: string, value: string | number) =>
  [`:host{`, `${cssVar}:${value};`, '}'].join('\n')

export const formatMediaRule = ({
  cssVar,
  query,
  value,
  id,
}: {
  cssVar: string
  id: string
  query: string
  value: string | number
}) =>
  [
    `@media ${query}{:host{`,
    `${cssVar}:${value};`,
    '}}',
    `:host([data-media-query="${id}"]){`,
    `${cssVar}:${value};`,
    '}',
  ].join('\n')

export const colorSchemeMediaQueries = new Map<'@light' | '@dark', string>([
  ['@light', '(prefers-color-scheme: light)'],
  ['@dark', '(prefers-color-scheme: dark)'],
])
