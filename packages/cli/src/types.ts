type AliasValue =  `{${string}}`
export type PrimitiveValue = string | number | AliasValue
export type ColorValue = `#${string}` | AliasValue
export type StrokeStyleValue =  'solid' |
  'dashed' |
  'dotted' |
  'double' |
  'groove' |
  'ridge' |
  'outset' |
  'inset' | 
  {
    lineCap: 'round' |'butt' | 'square'
    dashArray: number[]
  } |
  AliasValue
export type DimensionValue = number |
  {
    static: number
    [key:string] : number
  } |
  AliasValue
export type BorderValue = {
  color: ColorValue,
  width: DimensionValue,
  style: StrokeStyleValue
} | AliasValue
export type CubicBezierValue = number[] | AliasValue
export type DurationValue = `${number}ms` | AliasValue
export type DisplayFlexValue = 'flex' | 'inline-flex' | AliasValue
export type FlexDirectionValue = 'row' | 'row-reverse' | 'column' | 'column-reverse' | AliasValue
export type GapValue = DimensionValue | `${number}%` | AliasValue
export type AlignItemsValue = 'stretch' | 'center' | 'baseline' | 'start' | 'end' | AliasValue
export type FlexWrapValue = 'wrap' | 'wrap-reverse' | AliasValue
export type DistributeContentValue = 'start' |
  'end' |
  'center' |
  'space-between' |
  'space-around' |
  'stretch' |
  'space-evenly' |
  AliasValue
type FlexCommon = {
  display: DisplayFlexValue,
  'flex-direction'?: FlexDirectionValue
  'column-gap'?: GapValue
  'row-gap'?: GapValue
  'justify-content'?:  DistributeContentValue
  'align-items'?: AlignItemsValue
}
interface FlexAlignedContent extends FlexCommon {
  'flex-wrap': FlexWrapValue
  'align-content': DistributeContentValue
}
interface FlexNoAlignedContent extends FlexCommon {
  'flex-wrap': never
  'align-content': never
}
export type FlexValue = FlexAlignedContent | FlexNoAlignedContent | AliasValue
export type FontFamilyValue = string | string[] | AliasValue
export type FontSizeValue = DimensionValue
export type FontStyleValue = 'normal' | 'italic' | 'oblique' | `oblique ${number}deg` | AliasValue
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
export type GridDisplayValue = 'grid' | 'inline-grid' | AliasValue
export type GridTemplateValue = string[]
export type GridAutoValue = string[] | number[] | AliasValue
export type GridAutoFlowValue =  'row' | 'column' | 'row dense' | 'column dense' | AliasValue
export type GridValue = {
  display: GridDisplayValue
  'grid-template-columns'?: GridTemplateValue | AliasValue
  'grid-template-rows'?: GridTemplateValue | AliasValue
  'grid-template-areas'?: GridTemplateValue | AliasValue
  'column-gap'?: GapValue
  'row-gap'?: GapValue
  'justify-items'?: AlignItemsValue
  'align-items'?: AlignItemsValue
  'justify-content'?: DistributeContentValue
  'align-content'?: DistributeContentValue
  'grid-auto-columns'?: GridAutoValue
  'grid-auto-rows'?: GridAutoValue
  'grid-auto-flow'?: GridAutoFlowValue
} | AliasValue
export type LetterSpacingValue = 'normal' | DimensionValue
export type LineHeightValue = 'normal' | DimensionValue
export type PercentageValue = `${number}:${number}` | `${number}%` | number | AliasValue
export type ShadowValue = {
  'color': ColorValue
  'offsetX': number
  'offsetY': number
  'blur': number
  'spread': number
} | AliasValue
export type TimingValue = `${string}s` | `${string}ms` | AliasValue
export type TransitionValue = {
  duration: TimingValue
  delay:TimingValue
  timingFunction: 'ease' |
    'linear' |
    'ease-in' |
    'ease-out' |
    'ease-in-out' |
    'step-start' |
    'step-end' |
    {
      function: 'steps' | 'cubic-bezier'
      values: string[] | number[]
    }
} | AliasValue
export type TypographyValue = {
  'font-family': FontFamilyValue
  'font-size': FontSizeValue
  'font-weight': FontWeightValue
  'letter-spacing': LetterSpacingValue
  'line-height': LineHeightValue
} | AliasValue
export type TextTransformValue = 'none' |
  'capitalize' |
  'uppercase' |
  'lowercase' |
  'full-width' |
  'full-size-kana' |
  AliasValue

type $Extensions = string | number | boolean | Record<string, string | number  | boolean>

type $Value = PrimitiveValue |
ColorValue |
StrokeStyleValue |
BorderValue |
CubicBezierValue |
DimensionValue |
DurationValue |
FlexValue |
FontFamilyValue |
FontSizeValue |
FontStyleValue |
FontWeightValue |
GradientValue |
GridValue |
LetterSpacingValue |
LineHeightValue |
PercentageValue |
ShadowValue |
TimingValue |
TransitionValue |
TypographyValue |
TextTransformValue

type TokenTypes = 
  'alignItems' |
  'border' |
  'color' |
  'cubicBezier' |
  'dimension' |
  'displayFlex' |
  'distributeContent' |
  'duration' |
  'flex' |
  'flexDirection' |
  'flexDisplay' |
  'flexWrap' |
  'fontFamily' |
  'fontSize' |
  'fontStyle' |
  'fontWeight' |
  'gap' |
  'gradient' |
  'grid' |
  'gridDisplay' |
  'gridTemplate' |
  'gridAuto' |
  'gridAutoFlow' |
  'letterSpacing' |
  'lineHeight' |
  'percentage' |
  'primitive' |
  'shadow' |
  'strokeStyle' |
  'textTransform' |
  'textDecoration' |
  'transition' |
  'typography'

// basic design token definition pulled from the https://design-tokens.github.io/community-group/format/#design-token-0
export type DesignToken  = {
  $value: $Value
  $type: TokenTypes
  $extensions?: $Extensions
  $description?: string
}

// general tokens object type definition
export interface DesignTokenGroup {
  [key: string]: DesignTokenGroup | DesignToken | undefined
}

// Shared type for token-schema-util parser
type ParseShared  = {
  $value?: $Value
}

//token-schema-util Schema type definition
export interface Schema extends ParseShared {
  properties?: Schema
  items?: Schema | Schema[]
  type?: string
  required?: string[]
  [key: string]: Schema | Schema[] | string[] | string | $Value | undefined
}

//token-schema-util JSON type definition
export interface JSON extends ParseShared {
  properties?: JSON
  items?: JSON
  [key: string]: JSON | JSON[] | string[] | string | $Value | undefined
}

export type Formatter = (args: {
  tokenPath: string[],
  $value: $Value
  prefix?: string
  _allTokens: DesignTokenGroup
}) => string

export type FormatterObject = Record<TokenTypes, Formatter>

