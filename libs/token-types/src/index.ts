/**
 * Alias value type points to another token value
 */
export type AliasValue = `{${string}}`

/**
 * Primitive value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type PrimitiveValue = string | number | (string | number)[] | AliasValue

/**
 * Color value type relies on the color formatter for css tokens and defaultFormat formatter for ts tokens
 */
export type ColorValue =
  | {
      l?: number | `${number}%`
      c?: number | `${number}%`
      h?: number | `${number}deg` | `${number}grad` | `${number}rad` | `${number}turn`
      a?: number
    }
  | AliasValue

/**
 * Dimension value type relies on the dimension formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type DimensionValue = number | AliasValue

/**
 * Border value type relies on the border formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type BorderValue =
  | {
      color: ColorValue
      width: number | AliasValue
      style: 'solid' | 'dashed' | 'dotted' | 'double' | 'groove' | 'ridge' | 'outset' | 'inset'
    }
  | AliasValue

/**
 * DropShadow value type relies on the dropShadow formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type DropShadowValue =
  | {
      offsetX: number
      offsetY: number
      blur?: number
      color?: ColorValue
    }
  | AliasValue

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

/**
 * PercentageRatio value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type PercentageRatioValue = `${number}:${number}` | `${number}%` | 1 | 0 | `0.${number}` | AliasValue

/**
 * Layout value types
 */
/**
 * AlignItems value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type AlignItemsValue = 'stretch' | 'center' | 'baseline' | 'start' | 'end' | AliasValue
/**
 * Display value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type DisplayValue = 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | AliasValue
/**
 * DistributeContent value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type DistributeContentValue =
  | 'start'
  | 'end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'stretch'
  | 'space-evenly'
  | AliasValue
/**
 * FlexDirection value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type FlexDirectionValue = 'row' | 'row-reverse' | 'column' | 'column-reverse' | AliasValue
/**
 * FlexWrap value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type FlexWrapValue = 'wrap' | 'wrap-reverse' | AliasValue
/**
 * Flex value type used for applying aliased flex rules inline in TS or
 * with the tokensGet postCSS plugin as a nested set of css rules.
 * Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.
 */
export type FlexValue =
  | {
      display: AliasValue
      flexDirection?: AliasValue
      columnGap?: AliasValue
      rowGap?: AliasValue
      justifyContent?: AliasValue
      alignItems?: AliasValue
      flexWrap?: AliasValue
      alignContent?: AliasValue
    }
  | AliasValue
/**
 * Gap value type relies on the gap formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type GapValue = DimensionValue | `${number}%`
/**
 * GridAutoFlow value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type GridAutoFlowValue = 'row' | 'column' | 'row dense' | 'column dense' | AliasValue

export type GridMinMaxArgs = number | `${number}fr` | `${number}%` | 'auto' | 'min-content' | 'max-content'
export type GridTemplateAreasValue = `"${string}"`[]
export type GridTemplateAxisValue =
  | GridMinMaxArgs
  | {
      function: 'minmax'
      range: [GridMinMaxArgs, GridMinMaxArgs]
    }
  | {
      function: 'fit-content'
      value: `${number}%` | number
    }

export type GridTemplateRowsOrColumnsValue = (
  | GridTemplateAxisValue
  | {
      function: 'repeat'
      count: number | 'auto-fill' | 'auto-fit'
      tracks: GridTemplateAxisValue[]
    }
)[]
/**
 * GridTemplate value type relies on the gridTemplate formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 * It is used to store grid-template-areas | grid-template-columns | grid-template-rows values
 */
export type GridTemplateValue = GridTemplateAreasValue | GridTemplateRowsOrColumnsValue

/**
 * Grid value type used for applying aliased grid rules inline in TS or
 * with the tokensGet postCSS plugin as a nested set of css rules.
 * Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.
 */
export type GridValue =
  | {
      display: AliasValue
      gridTemplateColumns?: AliasValue // take a look at one more time before adding GridTemplate
      gridTemplateRows?: AliasValue // take a look at one more time before adding GridTemplate
      gridTemplateAreas?: AliasValue // take a look at one more time before adding GridTemplate
      columnGap?: AliasValue
      rowGap?: AliasValue
      justifyItems?: AliasValue
      alignItems?: AliasValue
      justifyContent?: AliasValue
      alignContent?: AliasValue
      gridAutoColumns?: AliasValue // take a look at one more time before adding GridTemplate
      gridAutoRows?: AliasValue // take a look at one more time before adding GridTemplate
      gridAutoFlow?: AliasValue
    }
  | AliasValue

/**
 * Transition value types
 */
/**
 * FontStyle value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type TimingValue = `${number}s` | `${number}ms` | AliasValue
/**
 * Transition value type relies on the transition formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type TransitionValue =
  | {
      duration: TimingValue
      delay?: TimingValue
      timingFunction?:
        | 'ease'
        | 'linear'
        | 'ease-in'
        | 'ease-out'
        | 'ease-in-out'
        | 'step-start'
        | 'step-end'
        | {
            function: 'steps' | 'cubic-bezier'
            values: (string | number)[]
          }
    }
  | AliasValue

/**
 * Typography value types
 */

/**
 * FontFamily value type relies on formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type FontFamilyValue = string | string[] | AliasValue
/**
 * FontFamily value type relies on the dimension formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type FontSizeValue = DimensionValue
/**
 * FontStyle value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type FontStyleValue = 'normal' | 'italic' | 'oblique' | `oblique ${number}deg` | AliasValue
/**
 * FontWeight value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type FontWeightValue =
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 'normal'
  | 'bold'
  | 'lighter'
  | 'bolder'
  | AliasValue
/**
 * FontFamily value type relies on the dimension formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type LetterSpacingValue = DimensionValue
/**
 * FontFamily value type relies on the dimension formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type LineHeightValue = DimensionValue
/**
 * FontWeight value type relies on the defaultFormat formatter for ts tokens and css tokens
 */
export type TextTransformValue =
  | 'none'
  | 'capitalize'
  | 'uppercase'
  | 'lowercase'
  | 'full-width'
  | 'full-size-kana'
  | AliasValue
/**
 * Typography value type used for applying aliased typography rules inline in TS or
 * with the tokensGet postCSS plugin as a nested set of css rules.
 * Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.
 */
export type TypographyValue =
  | {
      fontFamily: AliasValue
      fontSize: AliasValue
      fontStyle?: AliasValue
      fontWeight: AliasValue
      letterSpacing?: AliasValue
      lineHeight?: AliasValue
      textTransform?: AliasValue
    }
  | AliasValue

export type ContextValue<V> = {
  [key: string]: V
}

export type DesignValue =
  | PrimitiveValue
  | ColorValue
  | DimensionValue
  | BorderValue
  | DropShadowValue
  | GradientValue
  | PercentageRatioValue
  | AlignItemsValue
  | DisplayValue
  | DistributeContentValue
  | FlexDirectionValue
  | FlexWrapValue
  | FlexValue
  | GapValue
  | GridAutoFlowValue
  | GridTemplateValue
  | GridValue
  | TimingValue
  | TransitionValue
  | FontFamilyValue
  | FontSizeValue
  | FontStyleValue
  | FontWeightValue
  | LetterSpacingValue
  | LineHeightValue
  | TextTransformValue
  | TypographyValue

export type $Context = 'media-query' | 'color-scheme' | 'container-query'

export type StaticToken<T extends string, V extends DesignValue> = {
  $description: string
  $extensions?: {
    ['plaited-context']?: never
    [key: string]: unknown
  }
  $type: T
  $value: V
}

export type ContextualToken<T extends string, V extends DesignValue> = {
  $description: string
  $extensions?: {
    ['plaited-context']: $Context
    [key: string]: unknown
  }
  $type: T
  $value: ContextValue<V>
}

export type BaseToken<T extends string, V extends DesignValue> = StaticToken<T, V> | ContextualToken<T, V>

export type PrimitiveToken = BaseToken<'primitive', PrimitiveValue>

export type ColorToken = BaseToken<'color', ColorValue>

export type DimensionToken = BaseToken<'dimension', DimensionValue>

export type BorderToken = BaseToken<'border', BorderValue>

export type DropShadowToken = BaseToken<'dropShadow', DropShadowValue>

export type GradientToken = BaseToken<'gradient', GradientValue>

export type PercentageRatioToken = BaseToken<'percentageRatio', PercentageRatioValue>

export type AlignItemsToken = BaseToken<'alignItems', AlignItemsValue>

export type DisplayToken = BaseToken<'display', DisplayValue>

export type DistributeContentToken = BaseToken<'distributeContent', DistributeContentValue>

export type FlexDirectionToken = BaseToken<'flexDirection', FlexDirectionValue>

export type FlexWrapToken = BaseToken<'flexWrap', FlexWrapValue>

export type FlexToken = {
  $description: string
  $extensions?: {
    ['plaited-context']?: never
    [key: string]: unknown
  }
  $type: 'flex'
  $value: FlexValue
}

export type GapToken = BaseToken<'gap', GapValue>

export type GridAutoFlowToken = BaseToken<'gridAutoFlow', GridAutoFlowValue>

export type GridTemplateToken = BaseToken<'gridTemplate', GridTemplateValue>

export type GridToken = {
  $description: string
  $extensions?: {
    ['plaited-context']?: never
    [key: string]: unknown
  }
  $type: 'grid'
  $value: GridValue
}

export type TimingToken = BaseToken<'timing', TimingValue>

export type TransitionToken = BaseToken<'transition', TransitionValue>

export type FontFamilyToken = BaseToken<'fontFamily', FontFamilyValue>

export type FontSizeToken = BaseToken<'fontSize', FontSizeValue>

export type FontStyleToken = BaseToken<'fontStyle', FontStyleValue>

export type FontWeightToken = BaseToken<'fontWeight', FontWeightValue>

export type LetterSpacingToken = BaseToken<'letterSpacing', LetterSpacingValue>

export type LineHeightToken = BaseToken<'lineHeight', LineHeightValue>

export type TextTransformToken = BaseToken<'textTransform', TextTransformValue>

export type TypographyToken = {
  $description: string
  $extensions?: {
    ['plaited-context']?: never
    [key: string]: unknown
  }
  $type: 'typography'
  $value: TypographyValue
}

export type DesignToken =
  | PrimitiveToken
  | ColorToken
  | DimensionToken
  | BorderToken
  | DropShadowToken
  | GradientToken
  | PercentageRatioToken
  | AlignItemsToken
  | DisplayToken
  | DistributeContentToken
  | FlexDirectionToken
  | FlexWrapToken
  | FlexToken
  | GapToken
  | GridAutoFlowToken
  | GridTemplateToken
  | GridToken
  | TimingToken
  | TransitionToken
  | FontFamilyToken
  | FontSizeToken
  | FontStyleToken
  | FontWeightToken
  | LetterSpacingToken
  | LineHeightToken
  | TextTransformToken
  | TypographyToken

// general tokens object type definition
export type DesignTokenGroup = {
  [key: string]: DesignTokenGroup | DesignToken
}

export type DimensionLikeTokens = DimensionToken | LineHeightToken | LetterSpacingToken | FontSizeToken

export type DimensionLikeValues = DimensionValue | LineHeightValue | LetterSpacingValue | FontSizeValue

export type PrimitiveLikeTokens =
  | PrimitiveToken
  | PercentageRatioToken
  | AlignItemsToken
  | DisplayToken
  | DistributeContentToken
  | FlexDirectionToken
  | FlexWrapToken
  | GridAutoFlowToken
  | TimingToken
  | FontStyleToken
  | FontWeightToken
  | TextTransformToken

export type PrimitiveLikeValues =
  | PrimitiveValue
  | PercentageRatioValue
  | AlignItemsValue
  | DisplayValue
  | DistributeContentValue
  | FlexDirectionValue
  | FlexWrapValue
  | GridAutoFlowValue
  | TimingValue
  | FontStyleValue
  | FontWeightValue
  | TextTransformValue
