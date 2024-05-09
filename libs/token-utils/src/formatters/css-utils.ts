import type {
  MediaQueries,
  ColorSchemes,
  ColorValue,
  AliasValue,
  ContextTypes,
  DesignTokenGroup,
  DesignToken,
  BaseToken,
} from '../types.js'
import { kebabCase, isTypeOf } from '@plaited/utils'
import { resolveAlias } from './resolve-alias.js'
import { prefix } from './constants.js'
export const remSuffix = (val: number) => `${val}rem`

export const getColor = (color: Exclude<ColorValue, AliasValue>) =>
  isTypeOf<string>(color, 'string') ? color : (
    `oklch(${color.l ?? 'none'} ${color.c ?? 'none'} ${color.h ?? 'none'} / ${color.a ?? 'none'})`
  )

export const getRule = ({
  contexts: { mediaQueries = {}, colorSchemes = {} } = {},
  ctx,
  prop,
  value,
}: {
  contexts?: {
    mediaQueries?: MediaQueries
    colorSchemes?: ColorSchemes
  }
  ctx?: { type: ContextTypes; id: string }
  prop: string
  value: string | number
}): string => {
  if (!ctx) return [`:host{`, `--${prefix}-${prop}:${value};`, '}'].join('\n')
  const { type, id } = ctx
  if (type === 'color-scheme' && Object.hasOwn(colorSchemes, id)) {
    return [
      Object.keys(colorSchemes).indexOf(id) === 0 && `:host{`,
      `--${prefix}-${prop}:${value};`,
      '}',
      `@media (prefers-color-scheme:${id}){:host{`,
      `--${prefix}-${prop}:${value};`,
      '}}',
      `:host([data-color-scheme="${id}"]){`,
      `--${prefix}-${prop}:${value};`,
      '}',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (type === 'media-query' && Object.hasOwn(mediaQueries, id)) {
    return [
      Object.keys(mediaQueries).indexOf(id) === 0 && `:host{`,
      `--${prefix}-${prop}:${value};`,
      '}',
      `@media ${mediaQueries[id]}{:host{`,
      `--${prefix}-${prop}:${value};`,
      '}}',
      `:host([data-media-query="${id}"]){`,
      `--${prefix}-${prop}:${value};`,
      '}',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return ''
}

export const resolveCSSVar = (value: string, allTokens: DesignTokenGroup | undefined) => {
  const res = resolveAlias(value, allTokens)
  if (!res) return ''
  const [, path] = res
  return `var(--${prefix}-${kebabCase(path.join(' '))})`
}

export const hasCommaSeparatedValue = <T extends DesignToken>(token: BaseToken<T['$value'], T['$type']>) =>
  Boolean(token?.$extensions?.plaited?.commaSeparated)
