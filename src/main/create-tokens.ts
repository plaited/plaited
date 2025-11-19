import { CSS_RESERVED_KEYS } from './css.constants.js'
import type {
  DesignTokenGroup,
  DesignToken,
  NestedDesignTokenStatements,
  DesignTokenReferences,
  DesignTokenReference,
  FunctionTokenValue,
} from './css.types.js'
import { kebabCase, isTypeOf } from '../utils.js'
import { isTokenReference, getRule } from './css.utils.js'

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
    styles.push(...$value.styles)
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
const getToken = ({
  cssVar,
  token,
  styles,
}: {
  cssVar: `--${string}`
  token: DesignToken
  styles: string[]
}): string => {
  const { $csv, $value } = token
  return Array.isArray($value) ?
      getRule(
        cssVar,
        $value
          .map((val) => (isFunctionTokenValue(val) ? getFunctionValue(val, styles) : getTokenValue(val, styles)))
          .join($csv ? ',' : ' '),
      )
    : getRule(cssVar, isFunctionTokenValue($value) ? getFunctionValue($value, styles) : getTokenValue($value, styles))
}

/**
 * @internal
 * Recursively processes design tokens to generate :host selector rules with CSS custom properties.
 * Handles nested statements and compound selectors for conditional token values.
 */
const formatTokenStatement = ({
  styles,
  cssVar,
  token,
  selectors = [],
  host,
}: {
  styles: string[]
  cssVar: `--${string}`
  token: DesignToken | NestedDesignTokenStatements
  selectors?: string[]
  host: string
}) => {
  if (isToken(token)) {
    const arr = selectors.map((str) => `${str}{`)
    styles.push(`${host}{${arr.join('')}${getToken({ cssVar, token, styles })}${'}'.repeat(arr.length)}}`)
    return
  }
  for (const [key, val] of Object.entries(token)) {
    if (key === CSS_RESERVED_KEYS.$default) {
      formatTokenStatement({
        styles,
        cssVar,
        token: val,
        selectors,
        host,
      })
      continue
    }
    formatTokenStatement({
      styles,
      cssVar,
      token: val,
      selectors: [...selectors, key],
      host,
    })
  }
}

/**
 * Creates a design token system using CSS custom properties.
 * Generates CSS variables scoped to the Shadow DOM host element and returns type-safe reference functions.
 * Supports primitive values, arrays, CSS functions (calc, rgb, etc.), nested rules, and token composition.
 *
 * @template T - The type of the design token group
 * @param ident - Base identifier for the token group (converted to kebab-case for CSS variable naming)
 * @param group - Object defining design tokens with their values and conditions
 * @returns Object mapping token names to reference functions that return CSS var() expressions
 *
 * @example Basic color tokens
 * ```ts
 * const colors = createTokens('color', {
 *   primary: { $value: '#007bff' },
 *   secondary: { $value: '#6c757d' },
 *   success: { $value: '#28a745' }
 * });
 *
 * // Use in styles:
 * const button = createStyles({
 *   primary: {
 *     backgroundColor: colors.primary,  // var(--color-primary)
 *     color: 'white'
 *   }
 * });
 * ```
 *
 * @example Spacing tokens with arrays
 * ```ts
 * const spacing = createTokens('spacing', {
 *   padding: {
 *     $value: [16, 24, 16, 24],
 *     $csv: false  // Join with spaces, not commas
 *   }
 * });
 * // Generates: --spacing-padding: 16 24 16 24;
 * ```
 *
 * @example Function-based tokens (calc, rgb, etc.)
 * ```ts
 * const computed = createTokens('computed', {
 *   doubleSpace: {
 *     $value: {
 *       $function: 'calc',
 *       $arguments: ['16px * 2']
 *     }
 *   },
 *   rgbColor: {
 *     $value: {
 *       $function: 'rgb',
 *       $arguments: [0, 123, 255],
 *       $csv: true  // Join with commas
 *     }
 *   }
 * });
 * ```
 *
 * @example Nested tokens with responsive values
 * ```ts
 * const responsive = createTokens('font', {
 *   size: {
 *     $default: { $value: '16px' },
 *     '@media (min-width: 768px)': { $value: '18px' },
 *     '@media (min-width: 1024px)': { $value: '20px' }
 *   }
 * });
 * ```
 *
 * @example Compound selectors for conditional tokens
 * ```ts
 * const themed = createTokens('theme', {
 *   background: {
 *     $default: { $value: 'white' },
 *     $compoundSelectors: {
 *       '.dark-mode': { $value: '#1a1a1a' },
 *       '[data-theme="high-contrast"]': { $value: 'black' }
 *     }
 *   }
 * });
 * // Generates:
 * // :host { --theme-background: white; }
 * // :host(.dark-mode) { --theme-background: #1a1a1a; }
 * // :host([data-theme="high-contrast"]) { --theme-background: black; }
 * ```
 *
 * @example Token composition (referencing other tokens)
 * ```ts
 * const base = createTokens('base', {
 *   spacing: { $value: '8px' }
 * });
 *
 * const derived = createTokens('derived', {
 *   doublePadding: {
 *     $value: {
 *       $function: 'calc',
 *       $arguments: [base.spacing, '* 2']
 *     }
 *   }
 * });
 * ```
 *
 * @remarks
 * - Token names are converted to kebab-case CSS variable names (e.g., `primaryColor` → `--ident-primary-color`)
 * - Each token returns a function that outputs `var(--css-variable-name)`
 * - The returned function has a `styles` property containing all required CSS declarations
 * - Supports nested rules for responsive design, pseudo-classes, and attribute selectors
 * - Token references can be composed to build complex design systems
 * - CSS custom properties are scoped to the `:host` selector for Shadow DOM encapsulation
 *
 * @see {@link DesignTokenGroup} for the input type structure
 * @see {@link DesignTokenReferences} for the return type structure
 * @see {@link createStyles} for using tokens in style definitions
 * @see {@link createHostStyles} for using tokens in host styles
 */
export const createTokens = <T extends DesignTokenGroup>(ident: string, group: T) =>
  Object.entries(group).reduce((acc, [prop, value]) => {
    const cssVar: `--${string}` = `--${kebabCase(ident)}-${kebabCase(prop)}`
    const styles: string[] = []
    if (isToken(value)) {
      formatTokenStatement({
        styles,
        cssVar,
        token: value,
        host: ':host',
      })
    } else {
      // Check if value is an object and has $compoundSelectors property
      const { $compoundSelectors, ...rest } = value
      if (Object.keys(rest).length) {
        formatTokenStatement({
          styles,
          cssVar,
          token: rest,
          host: ':host',
        })
      }

      if ($compoundSelectors) {
        for (const [selector, value] of Object.entries($compoundSelectors)) {
          formatTokenStatement({
            styles,
            cssVar,
            token: value,
            host: `:host(${selector})`,
          })
        }
      }
    }
    const getRef = (): `var(--${string})` => `var(${cssVar})`
    getRef.styles = styles
    acc[prop as keyof T] = getRef
    return acc
  }, {} as DesignTokenReferences<T>)
