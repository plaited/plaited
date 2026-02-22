import { isTypeOf, kebabCase } from '../utils.ts'
import type {
  DesignToken,
  DesignTokenGroup,
  DesignTokenReference,
  DesignTokenReferences,
  DesignTokenScale,
  FunctionTokenValue,
} from './css.types.ts'
import { getRule, isTokenReference } from './css.utils.ts'

/**
 * @internal
 * Type guard to check if a value is a DesignToken object.
 */
const isToken = (token: unknown): token is DesignToken =>
  isTypeOf<Record<string, unknown>>(token, 'object') && Object.hasOwn(token, '$value')

/**
 * @internal
 * Resolves a token value, handling both primitive values and token references.
 * Accumulates referenced token styles into the provided array.
 */
const getTokenValue = ($value: string | number | DesignTokenReference, styles: string[]) => {
  if (isTokenReference($value)) {
    styles.push(...$value.stylesheets)
    return $value()
  }
  return $value
}

/**
 * @internal
 * Type guard to check if a value is a function-based token value (e.g., calc(), rgb()).
 */
const isFunctionTokenValue = (value: unknown): value is FunctionTokenValue =>
  isTypeOf<Record<string, unknown>>(value, 'object') &&
  Object.hasOwn(value, '$function') &&
  Object.hasOwn(value, '$arguments')

/**
 * @internal
 * Generates a CSS function call string from a function token value.
 * Handles both single arguments and arrays of arguments with optional CSV formatting.
 */
const getFunctionValue = ({ $function, $arguments, $csv }: FunctionTokenValue, styles: string[]) => {
  if (Array.isArray($arguments)) {
    return `${$function}(${$arguments.map((val) => getTokenValue(val, styles)).join($csv ? ',' : ' ')})`
  }
  return `${$function}(${getTokenValue($arguments, styles)})`
}

/**
 * @internal
 * Generates a CSS custom property declaration from a design token.
 * Handles single values, arrays, and function-based values.
 */
const getTokenRule = ({
  cssVar,
  token,
  styles,
}: {
  cssVar: `--${string}`
  token: DesignToken
  styles: string[]
}): string => {
  const { $csv, $value } = token
  return Array.isArray($value)
    ? getRule(
        cssVar,
        $value
          .map((val) => (isFunctionTokenValue(val) ? getFunctionValue(val, styles) : getTokenValue(val, styles)))
          .join($csv ? ',' : ' '),
      )
    : getRule(cssVar, isFunctionTokenValue($value) ? getFunctionValue($value, styles) : getTokenValue($value, styles))
}

/**
 * @internal
 * Creates a token reference function for a single token.
 */
const createTokenRef = (cssVar: `--${string}`, token: DesignToken): DesignTokenReference => {
  const styles: string[] = []
  styles.push(`:root{${getTokenRule({ cssVar, token, styles })}}`)
  const getRef = (): `var(--${string})` => `var(${cssVar})`
  getRef.stylesheets = styles
  return getRef
}

/**
 * Creates a design token system using CSS custom properties.
 * Generates CSS variables scoped to the Shadow DOM host element and returns type-safe reference functions.
 * Supports primitive values, arrays, CSS functions (calc, rgb, etc.), and nested scales for organizing tokens.
 *
 * @template I - The identifier string type
 * @template T - The type of the design token group
 * @param ident - Base identifier for the token group (converted to kebab-case for CSS variable naming)
 * @param group - Object defining design tokens with their values
 * @returns Object mapping the identifier to token reference functions. Destructure to extract:
 *   `const { colors } = createTokens('colors', {...})`. Each token is a function returning CSS var() expressions.
 *
 * @example
 * ```typescript
 * // Simple tokens
 * const { colors } = createTokens('colors', {
 *   primary: { $value: '#007bff' },
 *   secondary: { $value: '#6c757d' },
 * })
 * colors.primary()  // 'var(--colors-primary)'
 *
 * // Nested scales
 * const { sizes } = createTokens('sizes', {
 *   icon: {
 *     sm: { $value: '16px' },
 *     md: { $value: '24px' },
 *     lg: { $value: '32px' },
 *   },
 * })
 * sizes.icon.sm()  // 'var(--sizes-icon-sm)'
 * ```
 *
 * @remarks
 * - Token names are converted to kebab-case CSS variable names (e.g., `primaryColor` → `--ident-primary-color`)
 * - Each token returns a function that outputs `var(--css-variable-name)`
 * - The returned function has a `stylesheets` property containing all required CSS declarations
 * - Token references can be composed to build complex design systems
 * - CSS custom properties are scoped to the `:root` selector for Shadow DOM encapsulation
 *
 * @see {@link DesignTokenGroup} for the input type structure
 * @see {@link DesignTokenReferences} for the return type structure
 * @see {@link createStyles} for using tokens in style definitions
 * @see {@link createHostStyles} for using tokens in host styles
 */
export const createTokens = <I extends string, T extends DesignTokenGroup>(
  ident: I,
  group: T,
): Record<I, DesignTokenReferences<T>> => {
  const identKebab = kebabCase(ident)

  const result = Object.entries(group).reduce(
    (acc, [prop, value]) => {
      const propKebab = kebabCase(prop)

      if (isToken(value)) {
        // Simple token
        const cssVar: `--${string}` = `--${identKebab}-${propKebab}`
        acc[prop as keyof T] = createTokenRef(cssVar, value) as DesignTokenReferences<T>[keyof T]
      } else {
        // Nested scale
        const scale = value as DesignTokenScale
        const scaleRefs = Object.entries(scale).reduce(
          (scaleAcc, [scaleKey, scaleToken]) => {
            const scaleKeyKebab = kebabCase(scaleKey)
            const cssVar: `--${string}` = `--${identKebab}-${propKebab}-${scaleKeyKebab}`
            scaleAcc[scaleKey] = createTokenRef(cssVar, scaleToken)
            return scaleAcc
          },
          {} as Record<string, DesignTokenReference>,
        )
        acc[prop as keyof T] = scaleRefs as DesignTokenReferences<T>[keyof T]
      }

      return acc
    },
    {} as DesignTokenReferences<T>,
  )

  return { [ident]: result } as Record<I, DesignTokenReferences<T>>
}
