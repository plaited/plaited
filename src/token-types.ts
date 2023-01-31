/**
 * Alias value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type AliasValue =  `{${string}}`


/**
 * Primitive value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type PrimitiveValue = string | number | AliasValue


/**
 * PrimitiveArray value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type PrimitiveArrayValue = (string| number)[] | AliasValue


/**
 * Color value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type ColorValue = `#${string}`  | AliasValue


export type ScalarDimensionValue = {
  [key:string] : number
}
/**
 * Dimension value type relies on the dimension formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */  
export type DimensionValue = number |
ScalarDimensionValue |
  AliasValue


/**
 * Border value type relies on the border formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */  
export type BorderValue = {
  color: ColorValue,
  width: number | AliasValue,
  style: 'solid' |
  'dashed' |
  'dotted' |
  'double' |
  'groove' |
  'ridge' |
  'outset' |
  'inset'
} | AliasValue


/**
 * DropShadow value type relies on the dropShadow formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type DropShadowValue = {
  offsetX: number
  offsetY: number
  blur?: number
  color?: ColorValue
} | AliasValue


/**
 * Gradient value type relies on the gradient formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type GradientValue = {
  gradientFunction: 'linear-gradient'|
    'radial-gradient' |
    'conic-gradient' |
    'repeating-linear-gradient' |
    'repeating-radial-gradient' |
    'repeating-conic-gradient'
  angleShapePosition?: string
  colorStops: {
    color?: ColorValue,
    position?: string
  }[]
} | AliasValue


/**
 * PercentageRatio value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type PercentageRatioValue = `${number}:${number}` | `${number}%` | 1 | 0 | `0.${number}` | AliasValue 


/**
 * Layout value types
 */
/**
 * AlignItems value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type AlignItemsValue = 'stretch' | 'center' | 'baseline' | 'start' | 'end' | AliasValue
/**
 * Display value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
 */
export type DisplayValue = 'flex' | 'inline-flex' | 'grid' | 'inline-grid' | AliasValue
/**
 * DistributeContent value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type DistributeContentValue = 'start' |
'end' |
'center' |
'space-between' |
'space-around' |
'stretch' |
'space-evenly' |
AliasValue
/**
 * FlexDirection value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type FlexDirectionValue = 'row' | 'row-reverse' | 'column' | 'column-reverse' | AliasValue
/**
 * FlexWrap value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
*/
export type FlexWrapValue = 'wrap' | 'wrap-reverse' | AliasValue
/**
 * Flex value type used for applying aliased flex rules inline in TS or
 * with the tokensGet postCSS plugin as a nested set of css rules.
 * Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.
*/
export type FlexValue = {
  display: AliasValue
  flexDirection?: AliasValue
  columnGap?: AliasValue
  rowGap?: AliasValue
  justifyContent?:  AliasValue
  alignItems?: AliasValue
  flexWrap?: AliasValue
  alignContent?: AliasValue
} | AliasValue
/**
 * Gap value type relies on the gap formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type GapValue = DimensionValue | `${number}%` | AliasValue
/**
 * GridAutoFlow value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
 */
export type GridAutoFlowValue =  'row' | 'column' | 'row dense' | 'column dense' | AliasValue

export type GridMinMaxArgs =   number |
`${number}fr` |
`${number}%` |
'auto' |
'min-content' |
'max-content'
type GridTemplateAreasValue = `"${string}"`[]
type GridTemplateAxisValue = 
  GridMinMaxArgs |
  {
    function: 'minmax'
    range: [GridMinMaxArgs, GridMinMaxArgs]
  }|
  {
    function: 'fit-content'
    value: `${number}%` | number
  }

export type GridTemplateRowsOrColumnsValue = (GridTemplateAxisValue | {
  function: 'repeat'
  count: number | 'auto-fill' | 'auto-fit'
  tracks: GridTemplateAxisValue[]
})[]
/**
 * GridTemplate value type relies on the gridTemplate formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 * It is used to store grid-template-areas | grid-template-columns | grid-template-rows values
 */
export type GridTemplateValue =  GridTemplateAreasValue | GridTemplateRowsOrColumnsValue

/**
 * Grid value type used for applying aliased grid rules inline in TS or
 * with the tokensGet postCSS plugin as a nested set of css rules.
 * Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.
 */
export type GridValue = {
  display: AliasValue
  gridTemplateColumns?:AliasValue // take a look at one more time before adding GridTemplate
  gridTemplateRows?:AliasValue // take a look at one more time before adding GridTemplate
  gridTemplateAreas?:AliasValue // take a look at one more time before adding GridTemplate
  columnGap?: AliasValue
  rowGap?: AliasValue
  justifyItems?: AliasValue
  alignItems?: AliasValue
  justifyContent?: AliasValue
  alignContent?: AliasValue
  gridAutoColumns?: AliasValue // take a look at one more time before adding GridTemplate
  gridAutoRows?: AliasValue // take a look at one more time before adding GridTemplate
  gridAutoFlow?: AliasValue
} | AliasValue



/**
 * Transition value types
 */
/**
 * FontStyle value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
 */
export type TimingValue = `${number}s` | `${number}ms` | AliasValue 
/**
 * Transition value type relies on the transition formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type TransitionValue = {
  duration: TimingValue
  delay?:TimingValue
  timingFunction?: 'ease' |
    'linear' |
    'ease-in' |
    'ease-out' |
    'ease-in-out' |
    'step-start' |
    'step-end' |
    {
      function: 'steps' | 'cubic-bezier'
      values: (string | number)[]
    }
} | AliasValue


/**
 * Typography value types
 */

/**
 * FontFamily value type relies on the fontFamily formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type FontFamilyValue = string | string[] | AliasValue
/**
 * FontFamily value type relies on the dimension formatter for css tokens
 * and the defaultFormat formatter for ts tokens
 */
export type FontSizeValue = DimensionValue
/**
 * FontStyle value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
 */
export type FontStyleValue = 'normal' | 'italic' | 'oblique' | `oblique ${number}deg` | AliasValue
/**
 * FontWeight value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
 */
export type FontWeightValue = 100 |
  200 |
  300 |
  400 |
  500 |
  600 |
  700 |
  800 |
  900 |
  'normal' |
  'bold' |
  'lighter' |
  'bolder' |
  AliasValue
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
 * FontWeight value type relies on the fontFamily the defaultFormat formatter for ts tokens and css tokens
 */
export type TextTransformValue = 'none' |
  'capitalize' |
  'uppercase' |
  'lowercase' |
  'full-width' |
  'full-size-kana' |
  AliasValue
/**
 * Typography value type used for applying aliased typography rules inline in TS or
 * with the tokensGet postCSS plugin as a nested set of css rules.
 * Uses the nullFormat formatter for CSS and the ruleSet formatter for TS.
 */
export type TypographyValue = {
  fontFamily: AliasValue
  fontSize:  AliasValue
  fontStyle?: AliasValue
  fontWeight: AliasValue
  letterSpacing?:  AliasValue
  lineHeight?:  AliasValue
  textTransform?: AliasValue
} | AliasValue

type $Extensions = string | number | boolean | Record<string, string | number  | boolean>

export type $FormatterValue = PrimitiveValue |
PrimitiveArrayValue |
BorderValue |
DimensionValue |
GradientValue |
DropShadowValue |
GapValue |
FlexValue |
GridTemplateValue |
GridValue |
TransitionValue |
FontFamilyValue |
TypographyValue 

type ValueAndType =
  { 
    $type: 'primitive' 
    $value: PrimitiveValue | PrimitiveArrayValue
  }|
  { 
    $type: 'color' 
    $value: ColorValue
  }|
  { 
    $type: 'dimension' 
    $value: DimensionValue
  }|
  { 
    $type: 'border' 
    $value: BorderValue
  }|
  { 
    $type: 'dropShadow' 
    $value: DropShadowValue
  }|
  { 
    $type: 'gradient' 
    $value: GradientValue
  }|
  { 
    $type: 'percentageRatio' 
    $value: PercentageRatioValue
  }|
  /**
   * Layout { $value, $type }
   */
  { 
    $type: 'alignItems' 
    $value: AlignItemsValue
  }|
  {
    $type: 'display' 
    $value: DisplayValue
  }|
  { 
    $type: 'distributeContent' 
    $value: DistributeContentValue
  }|
  { 
    $type: 'flexDirection' 
    $value: FlexDirectionValue
  }|
  { 
    $type: 'flexWrap' 
    $value: FlexWrapValue 
  }|
  { 
    $type: 'flex' 
    $value: FlexValue
  }|
  { 
    $type: 'gap' 
    $value: GapValue
  }|
  { 
    $type: 'gridAutoFlow' 
    $value: GridAutoFlowValue
  }|
  {
    $type:'gridTemplate'
    $value: GridTemplateValue
  } |
  { 
    $type: 'grid' 
    $value: GridValue
  }|
  /**
   * Transition { $value, $type }
   */
  {
    $type: 'timing',
    $value: TimingValue
  }|
  { 
    $type: 'transition' 
    $value: TransitionValue
  }|
  /**
   * Typography { $value, $type }
   */
  { 
    $type: 'fontFamily'
    $value: FontFamilyValue
  }|
  { 
    $type: 'fontSize'
    $value: FontSizeValue
  }|
  { 
    $type: 'fontStyle'
    $value: FontStyleValue
  }|
  { 
    $type: 'fontWeight'
    $value: FontWeightValue
  }|
  { 
    $type: 'letterSpacing'
    $value: LetterSpacingValue
  }|
  { 
    $type: 'lineHeight'
    $value: LineHeightValue
  }|
  { 
    $type: 'textTransform'
    $value: TextTransformValue
  }|
  { 
    $type: 'typography' 
    $value: TypographyValue
  }

export type $Value = ValueAndType['$value']

// basic design token definition pulled from the https://design-tokens.github.io/community-group/format/#design-token-0
export type DesignToken  = {
  $extensions?: $Extensions
  $description: string
} & ValueAndType

// general tokens object type definition
export interface DesignTokenGroup {
  [key: string]: DesignTokenGroup | DesignToken
}

export type Formatter<T = $FormatterValue> = (args: {
  tokenPath: string[],
  $value: T
  allTokens: DesignTokenGroup
  baseFontSize: number
}) => string



export type GetFormatter = (args: {
  tokenPath: string[],
  $value:  $FormatterValue
  allTokens: DesignTokenGroup
  baseFontSize: number
  $type: string
}) => string