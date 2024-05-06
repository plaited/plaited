/**
 * Alias value type points to another token value
 */
export type AliasValue = `{${string}}`

/**
 * Default value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type DefaultValue = string | number | AliasValue | (string | number | AliasValue)[] 

/**
 * Number or percentage values relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type AmountValue = number | `${number}%` | AliasValue

/**
 * Number or percentage values relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type AngleValue = `${number}deg` | `${number}grad` | `${number}rad` | `${number}turn` | AliasValue

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
  |AliasValue


/**
 * Size value type relies on the size formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type SizeValue = AmountValue | AmountValue[]

/**
 * Gradient value type relies on the gradient formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type GradientValue =
  | {
      gradientFunction:
        | 'linear-gradient'
        | 'radial-gradient'
        | 'conic-gradient'
        | 'repeating-linear-gradient'
        | 'repeating-radial-gradient'
        | 'repeating-conic-gradient'
      angleShapePosition?: string
      colorStops: {
        color?: ColorValue
        position?: string
      }[]
    }
  | AliasValue

export type CompositeValue =
  | { [key: string]: AliasValue}
  | AliasValue

export type ContextValue<V> = {
  [key: string]: V
}

export type DesignValue =
  | DefaultValue
  | ColorValue
  | SizeValue
  | GradientValue
  | CompositeValue

export type ContextTypes = 'media-query' | 'color-scheme'

export type StaticToken<V extends DesignValue, T = undefined> = {
  $description: string
  $extensions?: {
    ['plaited']?: {
      context?: never
      commaSeparated?: boolean
    }
    [key: string]: unknown
  }
  $value: V
} & (T extends undefined ? { $type?: never } : { $type: T })

export type ContextualToken<V extends DesignValue, T = undefined> = {
  $description: string
  $extensions: {
    ['plaited']: {
      context: ContextTypes
      commaSeparated?: boolean
    }
    [key: string]: unknown
  }
  $value: ContextValue<V>
} & (T extends undefined ? { $type?: never } : { $type: T })

export type BaseToken<V extends DesignValue, T = undefined> = StaticToken<V, T> | ContextualToken<V, T>

export type DefaultToken = BaseToken<DefaultValue>

export type AmountToken = BaseToken<AmountValue, 'amount'> 

export type AngleToken = BaseToken<AngleValue, 'angle'>

export type ColorToken = BaseToken<ColorValue, 'color'>

export type SizeToken = BaseToken<SizeValue, 'size'>

export type GradientToken = BaseToken<GradientValue, 'gradient'>

export type CompositeToken = {
  $description: string
  $extensions?: {
    [key: string]: unknown
  }
  $type: 'composite'
  $value: CompositeValue
}

export type DesignToken =
  | DefaultToken
  | AmountToken
  | AngleToken
  | ColorToken
  | SizeToken
  | GradientToken
  | CompositeToken

// general tokens object type definition
export type DesignTokenGroup = {
  [key: string]: DesignTokenGroup | DesignToken
}

export type MediaQueries = {
  [key: string]: string;
};

export type ColorSchemes = {
  light?: "light";
  dark?: "dark";
};

export type Contexts = {
  mediaQueries: MediaQueries;
  colorSchemes: ColorSchemes;
};

export type FormatList = (args: {
  tokens: DesignTokenGroup;
  allTokens: DesignTokenGroup;
  tokenPath?: string[];
  getFormatters: GetFormatters;
  contexts: Contexts;
  $type?: string,
}) => string;

export type Formatter<T extends DesignToken = DesignToken> = (
  token: T,
  details: {
    tokenPath: string[];
    allTokens: DesignTokenGroup;
    contexts: Contexts;
  }
) => string;

export type GetFormatters = <
  T extends DesignTokenGroup = DesignTokenGroup,
  F extends DesignToken = DesignToken,
>(
  token: F,
  details: {
    tokenPath: string[];
    allTokens: T;
    contexts: Contexts;
  }
) => string;

export type TransformerParams = {
  /** an object of the type {@link DesignTokenGroup} */
  tokens: DesignTokenGroup;
  contexts: Contexts;
};

export type TransformTokensParams = {
  /** an object of the type {@link DesignTokenGroup} */
  tokens: DesignTokenGroup;
  /** named media queries */
  contexts?: Partial<Contexts>;
};