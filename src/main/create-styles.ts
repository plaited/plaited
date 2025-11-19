import { CSS_RESERVED_KEYS } from './css.constants.js'
import type { CreateParams, ClassNames, NestedStatements, CSSProperties, DesignTokenReference } from './css.types.js'
import { isTypeOf } from '../utils.js'
import { isTokenReference, getRule, createHash } from './css.utils.js'

/**
 * @internal
 * Recursively processes CSS property values to generate atomic CSS class rules.
 * Handles nested statements (media queries, pseudo-classes, attribute selectors) and design token references.
 * Accumulates styles into flat arrays for stylesheet generation.
 */
const formatClassStatement = ({
  styles,
  hostStyles,
  value,
  prop,
  selectors = [],
}: {
  styles: string[]
  hostStyles: string[]
  value: NestedStatements | CSSProperties[keyof CSSProperties] | DesignTokenReference
  prop: string
  selectors?: string[]
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    const arr = Object.entries(value)
    const length = arr.length
    for (let i = 0; i < length; i++) {
      const [context, val] = arr[i]
      if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
        const nextSelectors = [...selectors]
        context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
        formatClassStatement({ styles, value: val, prop, selectors: nextSelectors, hostStyles })
      }
    }
  } else {
    const isToken = isTokenReference(value)
    isToken && hostStyles.push(...value.styles)
    const rule = getRule(prop, isToken ? value() : value)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    styles.push(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
}

/**
 * Creates atomic CSS classes from style definitions with automatic hash-based class name generation.
 * Generates scoped CSS rules that can be adopted into Shadow DOM via Constructable Stylesheets.
 * Supports nested rules for responsive design, pseudo-classes, and attribute selectors.
 *
 * @template T - The type of the class definitions object
 * @param classNames - Object mapping logical class names to CSS property definitions
 * @returns Object mapping each logical name to generated class names and stylesheets
 *
 * @example Basic styling
 * ```ts
 * const button = createStyles({
 *   primary: {
 *     backgroundColor: 'blue',
 *     color: 'white',
 *     padding: '10px 20px',
 *     borderRadius: '4px'
 *   }
 * });
 * // Result: { primary: { classNames: ['primary', 'cls123', 'cls456', ...], stylesheets: [...] } }
 * ```
 *
 * @example Nested rules with pseudo-classes
 * ```ts
 * const interactive = createStyles({
 *   button: {
 *     color: {
 *       $default: 'black',
 *       ':hover': 'blue',
 *       ':active': 'darkblue'
 *     }
 *   }
 * });
 * ```
 *
 * @example Responsive design with media queries
 * ```ts
 * const responsive = createStyles({
 *   container: {
 *     width: {
 *       $default: '100%',
 *       '@media (min-width: 768px)': '750px',
 *       '@media (min-width: 1024px)': '960px'
 *     }
 *   }
 * });
 * ```
 *
 * @example Using design tokens
 * ```ts
 * const tokens = createTokens('theme', {
 *   primary: { $value: '#007bff' }
 * });
 *
 * const themed = createStyles({
 *   button: {
 *     backgroundColor: tokens.primary
 *   }
 * });
 * ```
 *
 * @remarks
 * - Class names are automatically hashed based on their CSS content for deduplication
 * - Each atomic property generates its own class for maximum reusability
 * - Design token references are resolved and their styles are included
 * - Supports Shadow DOM adoption via the `stylesheets` array
 *
 * @see {@link CreateParams} for the input type structure
 * @see {@link ClassNames} for the return type structure
 * @see {@link createTokens} for design token creation
 * @see {@link joinStyles} for combining multiple style objects
 */
export const createStyles = <T extends CreateParams>(classNames: T): ClassNames<T> =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const styles: string[] = []
    const hostStyles: string[] = []
    for (const [prop, value] of Object.entries(props)) formatClassStatement({ styles, hostStyles, prop, value })
    const classes: string[] = []
    const stylesheets: string[] = hostStyles
    for (const sheet of styles) {
      const cls = `cls${createHash(sheet)}`
      classes.push(cls)
      stylesheets.push(`.${cls}${sheet}`)
    }
    acc[cls as keyof T] = {
      classNames: [cls, ...classes],
      stylesheets,
    }
    return acc
  }, {} as ClassNames<T>)
