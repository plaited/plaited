/**
 * Template literal type representing a reference to another design token.
 * Format: {tokenName}
 * @example '{colors.primary}'
 */
export type Alias = `{${string}}`

/**
 * Basic value types for design tokens.
 * Supports primitives, references, and arrays of values.
 * @example 'bold' | 42 | '{spacing.base}' | ['1px', '{border.width}']
 */
export type DefaultValue = string | number | Alias | (string | number | Alias)[]
/**
 * Numeric values that can be expressed as raw numbers, percentages or reference.
 * @example 0.5 | '50%' | '{opacity.medium}'
 */
export type AmountValue = number | `${number}%` | Alias

/**
 * CSS angle values with unit support.
 * @example '45deg' | '100grad' | '1.57rad' | '0.5turn' | '{rotation.quarter}'
 */
export type AngleValue = `${number}deg` | `${number}grad` | `${number}rad` | `${number}turn` | Alias

/**
 * Color value definition supporting:
 * - LCH color space (lightness, chroma, hue, alpha)
 * - Hexadecimal colors
 * - Transparency
 * - Token references
 * @example
 * { l: 50, c: 30, h: '45deg', a: 0.8 }
 * '#FF0000'
 * '{colors.brand}'
 */
export type ColorValue =
  | {
      l?: AmountValue
      c?: AmountValue
      h?: number | AngleValue
      a?: AmountValue
    }
  | `#${string}`
  | 'transparent'
  | Alias

/**
 * Size measurements supporting multiple units and references.
 * @example '100%' | '16px' | '1.5rem' | '{spacing.large}' | ['100%', '16px']
 */
export type SizeValue =
  | `${number}%`
  | `${number}px`
  | `${number}rem`
  | Alias
  | (`${number}%` | `${number}px` | `${number}rem` | Alias)[]

/**
 * CSS function definitions with arguments.
 * @example
 * {
 *   function: 'linear-gradient',
 *   arguments: ['to right', '{colors.start}', '{colors.end}']
 * }
 */
export type FunctionValue =
  | {
      function: string
      arguments: DefaultValue
    }
  | Alias
/**
 * Composite tokens combining multiple token references.
 * @example
 * {
 *   border: '{borders.width}',
 *   color: '{colors.primary}'
 * }
 */
export type CompositeValue = { [key: string]: Alias } | Alias
/**
 * Union of all possible design token value types.
 */
export type DesignValue = DefaultValue | ColorValue | SizeValue | FunctionValue | CompositeValue
/**
 * Media query definitions for responsive token values.
 */
export type MediaQueries = Map<`@${string}`, string>
/**
 * Standard media query configurations.
 */
export type DefaultMediaQueries = {
  colorScheme?: '@light' | '@dark'
  screen?: `@${string}`
}
/**
 * Responsive value definition for design tokens.
 * @template V Type of the design value
 */
export type MediaValue<V extends DesignValue = DesignValue> = {
  [key: `@${string}`]: V
}
/**
 * Base structure for all design tokens.
 * @template V Value type for the token
 * @template T Optional token type identifier
 */
export type BaseToken<V extends DesignValue, T = undefined> = {
  $description: string
  $csv?: boolean
  $value: V | MediaValue<V>
} & (T extends undefined ? { $type?: never } : { $type: T })
/**
 * Default design token for basic values like strings and numbers.
 * Base token type without specific value formatting.
 * @example
 * const fontWeight: DefaultToken = {
 *   $description: "Font weight for body text",
 *   $value: "400"
 * }
 */
export type DefaultToken = BaseToken<DefaultValue>
/**
 * Design token for numeric or percentage values.
 * Used for opacity, scale factors, or other unit-less numbers.
 * @example
 * const opacity: AmountToken = {
 *   $description: "Primary opacity level",
 *   $type: "amount",
 *   $value: 0.8
 * }
 */
export type AmountToken = BaseToken<AmountValue, 'amount'>
/**
 * Design token for angle measurements.
 * Supports deg, grad, rad, and turn units.
 * @example
 * const rotate: AngleToken = {
 *   $description: "Rotation for hover effect",
 *   $type: "angle",
 *   $value: "45deg"
 * }
 */
export type AngleToken = BaseToken<AngleValue, 'angle'>
/**
 * Design token for color values.
 * Supports hex, LCH color space, and transparency.
 * @example
 * const primary: ColorToken = {
 *   $description: "Primary brand color",
 *   $type: "color",
 *   $value: { l: 50, c: 30, h: "45deg" }
 * }
 */
export type ColorToken = BaseToken<ColorValue, 'color'>
/**
 * Design token for dimensional measurements.
 * Supports px, rem, and percentage units.
 * @example
 * const spacing: SizeToken = {
 *   $description: "Base spacing unit",
 *   $type: "size",
 *   $value: "1rem"
 * }
 */
export type SizeToken = BaseToken<SizeValue, 'size'>
/**
 * Design token for CSS function values.
 * Used for gradients, transforms, and other CSS functions.
 * @example
 * const gradient: FunctionToken = {
 *   $description: "Primary gradient",
 *   $type: "function",
 *   $value: {
 *     function: "linear-gradient",
 *     arguments: ["to right", "{colors.start}", "{colors.end}"]
 *   }
 * }
 */
export type FunctionToken = BaseToken<FunctionValue, 'function'>
/**
 * Token type for composite values combining multiple tokens.
 */
export type CompositeToken = {
  $description: string
  $type: 'composite'
  $value: CompositeValue
}
/**
 * Union of all possible token types.
 */
export type DesignToken =
  | DefaultToken
  | AmountToken
  | AngleToken
  | ColorToken
  | SizeToken
  | FunctionToken
  | CompositeToken

/**
 * Hierarchical structure for organizing design tokens.
 */
export type DesignTokenGroup = {
  [key: string]: DesignTokenGroup | DesignToken
}
/**
 * Extended token type with resolution and dependency information.
 */
export type DesignTokenEntry = DesignToken & {
  dependencies: Alias[]
  dependents: Alias[]
  exportName?: string
  ts?: string
  cssVar?: string
  css?: string
}

type FilterCallback = (entry: [Alias, DesignTokenEntry], index: number, arr: [Alias, DesignTokenEntry][]) => boolean
/**
 * Interface for token transformation and resolution.
 * Provides methods for accessing and filtering resolved tokens.
 */
export interface TransformDesignTokensInterface {
  get ts(): string
  get css(): string
  get entries(): [Alias, DesignTokenEntry][]
  filter(cb: FilterCallback): [Alias, DesignTokenEntry][]
  get(alias: Alias): DesignTokenEntry | undefined
  has(alias: Alias): boolean
}
