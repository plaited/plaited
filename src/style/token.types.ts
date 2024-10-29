/**
 * Alias value type points to another token value
 */
export type Alias = `{${string}}`

/**
 * Default value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type DefaultValue = string | number | Alias | (string | number | Alias)[]

/**
 * Number or percentage values relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type AmountValue = number | `${number}%` | Alias

/**
 * Number or percentage values relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type AngleValue = `${number}deg` | `${number}grad` | `${number}rad` | `${number}turn` | Alias

/**
 * Color value type relies on the color formatter for css tokens and defaultFormat formatter for ts tokens
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
 * Size value type relies on the size formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type SizeValue =
  | `${number}%`
  | `${number}px`
  | `${number}rem`
  | Alias
  | (`${number}%` | `${number}px` | `${number}rem` | Alias)[]

/**
 * Function value type is used to set CSS function tokens
 */
export type FunctionValue =
  | {
      function: string
      arguments: DefaultValue
    }
  | Alias

export type CompositeValue = { [key: string]: Alias } | Alias

export type DesignValue = DefaultValue | ColorValue | SizeValue | FunctionValue | CompositeValue

export type MediaQueries = Map<`@${string}`, string>

export type DefaultMediaQueries = {
  colorScheme?: '@light' | '@dark'
  screen?: `@${string}`
}

export type MediaValue<V extends DesignValue = DesignValue> = {
  [key: `@${string}`]: V
}

export type BaseToken<V extends DesignValue, T = undefined> = {
  $description: string
  $csv?: boolean
  $value: V | MediaValue<V>
} & (T extends undefined ? { $type?: never } : { $type: T })

export type DefaultToken = BaseToken<DefaultValue>

export type AmountToken = BaseToken<AmountValue, 'amount'>

export type AngleToken = BaseToken<AngleValue, 'angle'>

export type ColorToken = BaseToken<ColorValue, 'color'>

export type SizeToken = BaseToken<SizeValue, 'size'>

export type FunctionToken = BaseToken<FunctionValue, 'function'>

export type CompositeToken = {
  $description: string
  $type: 'composite'
  $value: CompositeValue
}

export type DesignToken =
  | DefaultToken
  | AmountToken
  | AngleToken
  | ColorToken
  | SizeToken
  | FunctionToken
  | CompositeToken

// general tokens object type definition
export type DesignTokenGroup = {
  [key: string]: DesignTokenGroup | DesignToken
}

export type DesignTokenEntry = DesignToken & {
  dependencies: Alias[]
  dependents: Alias[]
  exportName?: string
  cssVar?: string
}

type FilterCallback = (entry: [Alias, DesignTokenEntry], index: number, arr: [Alias, DesignTokenEntry][]) => boolean

export interface TransformTokensInterface {
  get ts(): string
  get css(): string
  get entries(): [Alias, DesignTokenEntry][]
  filter(cb: FilterCallback): [Alias, DesignTokenEntry][]
  get(alias: Alias): DesignTokenEntry | undefined
  has(alias: Alias): boolean
}
