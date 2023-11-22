import { Queries, ColorSchemes } from './types.js'
import { ColorValue, AliasValue, $Context } from '@plaited/token-types'

export const getRem = (val: number, base: number) => `${val / base}rem`

export const getColor = (color: Exclude<ColorValue, AliasValue>) =>
  `oklch(${color.l ?? 'none'} ${color.c ?? 'none'} ${color.h ?? 'none'} / ${color.a ?? 'none'})`

export const getRule = ({
  colorSchemes = {},
  containerQueries = {},
  mediaQueries = {},
  context,
  prop,
  value,
}: {
  mediaQueries?: Queries
  containerQueries?: Queries
  colorSchemes?: ColorSchemes
  context?: { type: $Context; id: string }
  prop: string
  value: string | number
}): string => {
  if (!context) return [`:host{`, `--${prop}:${value};`, '}'].join('\n')
  const { type, id } = context
  if (type === 'color-scheme' && Object.hasOwn(colorSchemes, id)) {
    return [
      Object.keys(colorSchemes).indexOf(id) === 0 && `:host{`,
      `--${prop}:${value};`,
      '}',
      `@media (prefers-color-scheme:${id}){:host{`,
      `--${prop}:${value};`,
      '}}',
      `:host([data-color-scheme="${id}"]){`,
      `--${prop}:${value};`,
      '}',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (type === 'media-query' && Object.hasOwn(mediaQueries, id)) {
    return [
      Object.keys(mediaQueries).indexOf(id) === 0 && `:host{`,
      `--${prop}:${value};`,
      '}',
      `@media ${mediaQueries[id]}{:host{`,
      `--${prop}:${value};`,
      '}}',
      `:host([data-media-query="${id}"]){`,
      `--${prop}:${value};`,
      '}',
    ]
      .filter(Boolean)
      .join('\n')
  }
  if (type === 'container-query' && Object.hasOwn(containerQueries, id)) {
    return [
      Object.keys(containerQueries).indexOf(id) === 0 && `:host{`,
      `--${prop}:${value};`,
      '}',
      `@container ${containerQueries[id]}{:host{`,
      `--${prop}:${value};`,
      '}}',
      `:host([data-container-query="${id}"]){`,
      `--${prop}:${value};`,
      '}',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
