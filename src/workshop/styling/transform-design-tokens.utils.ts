import type { DesignToken, DesignTokenGroup, DesignValue, MediaValue, Alias } from './design-token.types.js'
import { isTypeOf } from '../../utils/is-type-of.js'
import { trueTypeOf } from '../../utils/true-type-of.js'
import { kebabCase, camelCase } from '../../utils/case.js'

/**
 * Combines duplicate CSS rules (like :root selectors) into a single rule block.
 * @param css The raw CSS string potentially containing duplicate selectors.
 * @returns A CSS string with combined rules.
 * @internal
 */
export const combineCSSRules = (css: string) => {
  const regex = /((?:.*:root|:root\([^)]*\))[^{\n]*)\{(\s*[\s\S]*?\s*)\}/gm
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

/**
 * Extracts the dot-separated path from a design token alias string (e.g., "{colors.primary.100}" -> "colors.primary.100").
 * @param value The alias string.
 * @returns An array representing the token path.
 * @internal
 */
export const getTokenPath = (value: string) => matchAlias(value).split('.')

/**
 * Creates a design token alias string from a path array, handling potential decimal keys.
 * @param tokenPath An array representing the token path (e.g., ['colors', 'primary', '100']).
 * @returns The formatted alias string (e.g., "{colors.primary.100}").
 * @internal
 */
export const getAlias = (tokenPath: string[]): Alias => {
  const lastKeyIsDecimal = /^\d*\.\d+$/.test(tokenPath[tokenPath.length - 1])
  const lastKey = lastKeyIsDecimal && `${tokenPath.pop()}`.replace('.', '_')
  return lastKey ? `{${camelCase(tokenPath.join('.'))}.${lastKey}}` : `{${camelCase(tokenPath.join('.'))}}`
}

/**
 * Generates a camelCase export name from a token path array for TypeScript variable names.
 * Handles decimal keys by appending them with an underscore.
 * @param tokenPath An array representing the token path.
 * @returns The camelCase export name (e.g., "colorsPrimary100").
 * @internal
 */
export const getExportName = (tokenPath: string[]): string => {
  const lastKeyIsDecimal = /^\d*_\d+$/.test(tokenPath[tokenPath.length - 1])
  const lastKey = lastKeyIsDecimal && tokenPath.pop()
  return lastKey ? `${camelCase(tokenPath.join(' '))}${lastKey}` : camelCase(tokenPath.join(' '))
}

/**
 * Generates the TypeScript export name directly from a design token alias.
 * @param alias The alias string.
 * @returns The camelCase export name.
 * @internal
 */
export const getAliasExportName = (alias: Alias) => {
  const path = getTokenPath(alias)
  return getExportName(path)
}

/**
 * Generates a kebab-case CSS custom property name fragment from an alias string.
 * Handles decimal keys by appending them with a hyphen.
 * @param value The alias string.
 * @returns The kebab-case property name fragment (e.g., "colors-primary-100").
 * @internal
 */
export const getProp = (value: Alias) => {
  const tokenPath = getTokenPath(value)
  const lastKeyIsDecimal = /^\d*_\d+$/.test(tokenPath[tokenPath.length - 1])
  const lastKey = lastKeyIsDecimal && tokenPath.pop()
  return lastKeyIsDecimal ? `${kebabCase(tokenPath.join(' '))}-${lastKey}` : kebabCase(tokenPath.join(' '))
}

/**
 * Converts a design token alias into a CSS `var()` function string.
 * @param alias The alias string.
 * @param prefix The prefix to use for the CSS custom property (e.g., 'pl').
 * @returns The CSS `var()` string (e.g., "var(--pl-colors-primary-100)").
 * @internal
 */
export const convertAliasToCssVar = (alias: Alias, prefix: string) => `var(--${prefix}-${getProp(alias)})`

/**
 * Type guard to check if an object is a DesignToken (has a $value property).
 * @param obj The object to check.
 * @returns True if the object is a DesignToken, false otherwise.
 * @internal
 */
export const isDesignToken = (obj: DesignToken | DesignTokenGroup): obj is DesignToken =>
  trueTypeOf(obj) === 'object' && Object.hasOwn(obj, '$value')

/**
 * Type guard to check if a design token's $value represents media-specific values.
 * @param $value The value to check.
 * @returns True if the value is a MediaValue object, false otherwise.
 * @internal
 */
export const isMediaValue = ($value: unknown): $value is MediaValue<DesignValue> => {
  return isTypeOf<Record<string, unknown>>($value, 'object') && Object.keys($value).every((key) => key.startsWith('@'))
}

/** @internal Matches the content inside curly braces of an alias string. */
const matchAlias = (value: string) => value.match(/^(?:\{)([^"]*?)(?:\})$/)?.[1] ?? ''

/**
 * Type guard to check if a value is a valid design token alias string (e.g., "{token.path}").
 * @param value The value to check.
 * @returns True if the value is an Alias string, false otherwise.
 * @internal
 */
export const valueIsAlias = (value: unknown): value is Alias => {
  if (isTypeOf<string>(value, 'string')) {
    return matchAlias(value).length > 0
  }
  return false
}

/**
 * Formats a non-media query CSS rule for a design token.
 * @param cssVar The full CSS custom property name (e.g., "--pl-color-primary").
 * @param value The CSS value for the property.
 * @returns A formatted CSS rule string targeting :root.
 * @internal
 */
export const formatNonMediaRule = (cssVar: string, value: string | number) =>
  [`:root{`, `${cssVar}:${value};`, '}'].join('\n')

/** Constant identifier for the light color scheme media query key. @internal */
export const LIGHT_ID = '@light' as const
/** Constant identifier for the dark color scheme media query key. @internal */
export const DARK_ID = '@dark' as const
/** Constant for the data attribute used to apply color scheme overrides. @internal */
export const DATA_COLOR_SCHEME = 'data-color-scheme' as const
/** Constant for the data attribute used to apply custom media query overrides. @internal */
export const DATA_MEDIA_QUERY = 'data-media-query' as const
/** Constant for the TypeScript file extension. @internal */
export const TS_EXTENSION = 'ts' as const
/** Constant for the CSS file extension. @internal */
export const CSS_EXTENSION = 'css' as const
/** Default prefix for Plaited design tokens. @internal */
export const PLAITED_PREFIX = 'pl' as const

/**
 * Formats a media query CSS rule for a design token, including data attribute selectors for overrides.
 * @param options Configuration object.
 * @param options.cssVar The full CSS custom property name.
 * @param options.id The media query identifier (e.g., '@light', '@desktop').
 * @param options.query The actual media query string (e.g., '(prefers-color-scheme: light)').
 * @param options.value The CSS value for the property within this media query.
 * @returns A formatted CSS rule string including the media query and data attribute selector.
 * @internal
 */
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
    `@media ${query}{:root{`,
    `${cssVar}:${value};`,
    '}}',
    `:root([${id === LIGHT_ID || id === DARK_ID ? `${DATA_COLOR_SCHEME}="${id}"` : `${DATA_MEDIA_QUERY}="${id}"`}]){`,
    `${cssVar}:${value};`,
    '}',
  ].join('\n')

/**
 * Default media queries for light and dark color schemes.
 * @internal
 */
export const colorSchemeMediaQueries = new Map<typeof LIGHT_ID | typeof DARK_ID, string>([
  [LIGHT_ID, '(prefers-color-scheme: light)'],
  [DARK_ID, '(prefers-color-scheme: dark)'],
])
