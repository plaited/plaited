import type {
  AliasValue,
  BaseToken,
  Contexts,
  ColorValue,
  CTX,
  DesignToken,
  DesignTokenGroup,
  StaticToken,
} from '../token.types.js'
import { isTypeOf } from '../../utils/is-type-of.js'
import { trueTypeOf } from '../../utils/true-type-of.js'
import { kebabCase, camelCase } from '../../utils/case.js'

export const deduplicateCSS = (css: string) => {
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

export const getAliasExportName = (alias: AliasValue) => {
  const path = matchAlias(alias).split('.')
  return camelCase(path.join(' '))
}

export const getTokenPath = (value: string) => matchAlias(value).split('.')

export const convertTokenPathToValue = (tokenPath: string[], prefix: string) =>
  `var(--${prefix}-${kebabCase(tokenPath.join(' '))})` as const

export const convertAliasToCssVar = (alias: AliasValue, prefix: string) => {
  const tokenPath = matchAlias(alias).split('.')
  return `var(--${prefix}-${kebabCase(tokenPath.join(' '))})` as const
}

export const getColor = (color: ColorValue) =>
  isTypeOf<string>(color, 'string') ? color : (
    `oklch(${color.l ?? 'none'} ${color.c ?? 'none'} ${color.h ?? 'none'} / ${color.a ?? 'none'})`
  )

export const isDesignToken = (obj: DesignToken | DesignTokenGroup): obj is DesignToken =>
  trueTypeOf(obj) === 'object' && Object.hasOwn(obj, '$value')

export const isStaticToken = <T extends DesignToken>(
  token: BaseToken<T['$value'], T['$type']>,
): token is StaticToken<T['$value'], T['$type']> => !token?.$extensions?.plaited?.context

export const isValidContext = ({ id, type }: CTX, contexts: Contexts) => {
  const { colorSchemes, mediaQueries } = contexts
  const obj =
    type === 'color-scheme' ? colorSchemes
    : type === 'media-query' ? mediaQueries
    : 'invalid context type'
  if (typeof obj === 'string') {
    console.error(`Context type [${type}] is an ${obj}`)
    return false
  }
  if (!Object.hasOwn(obj, id)) {
    const context = type === 'color-scheme' ? `colorSchemes` : `mediaQueries`
    console.error(`[${id}] not found in ${context}`)
    return false
  }
  return true
}

const matchAlias = (value: string) => value.match(/^(?:\{)([^"]*?)(?:\})$/)?.[1] ?? ''

export const valueIsAlias = (value: unknown): value is AliasValue => {
  if (isTypeOf<string>(value, 'string')) {
    const match = matchAlias(value)
    return Boolean(match?.[1])
  }
  return false
}
