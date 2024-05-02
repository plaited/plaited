import type { MediaQueries, ColorSchemes, ColorValue, AliasValue, ContextTypes, DesignTokenGroup } from '../types.js'
import { kebabCase } from '@plaited/utils';
import { resolveAlias } from './resole-alias.js';

export const getRem = (val: number, base: number) => `${val / base}rem`

export const getColor = (color: Exclude<ColorValue, AliasValue>) =>
  `oklch(${color.l ?? 'none'} ${color.c ?? 'none'} ${color.h ?? 'none'} / ${color.a ?? 'none'})`

export const getRule = ({
  contexts: { mediaQueries = {}, colorSchemes = {} } = {},
  ctx,
  prop,
  value,
}: {
  contexts?: {
    mediaQueries?: MediaQueries;
    colorSchemes?: ColorSchemes;
  };
  ctx?: { type: ContextTypes; id: string };
  prop: string;
  value: string | number; 
}): string => {
  if (!ctx) return [`:host{`, `--${prop}:${value};`, '}'].join('\n')
  const { type, id } = ctx
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
  return ''
}

export const resolveCSSVar = (value: string, allTokens: DesignTokenGroup | undefined) => {
  const res = resolveAlias(value, allTokens)
  if (!res) return ''
  const [, path] = res
  return `var(--${kebabCase(path.join(' '))})`
}