export type AliasValue =  `{${string}}`
export type PrimitiveValue = string | number | AliasValue
export type PrimitiveArrayValue = string[] | number[] | AliasValue
export type ColorValue = `#${string}`  | AliasValue
export type ScalarDimensionValue = {
  [key:string] : number
}
export type DimensionValue = number |
ScalarDimensionValue |
  AliasValue
export type BorderValue = {
  color: ColorValue,
  width: Exclude<DimensionValue, ScalarDimensionValue>,
  style: 'solid' |
  'dashed' |
  'dotted' |
  'double' |
  'groove' |
  'ridge' |
  'outset' |
  'inset'
} | AliasValue
export type DisplayFlexValue = 'flex' | 'inline-flex' | AliasValue
export type FlexDirectionValue = 'row' | 'row-reverse' | 'column' | 'column-reverse' | AliasValue //Uses Primitive Formatter
export type GapValue = DimensionValue | `${number}%` | AliasValue //Uses Primitive Formatter
export type AlignItemsValue = 'stretch' | 'center' | 'baseline' | 'start' | 'end' | AliasValue //Uses Primitive Formatter
export type FlexWrapValue = 'wrap' | 'wrap-reverse' | AliasValue //Uses Primitive Formatter
export type DistributeContentValue = 'start' | //Uses Primitive Formatter
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
export type FontFamilyValue = string | string[] | AliasValue //Uses Primitive Formatter
export type FontStyleValue = 'normal' | 'italic' | 'oblique' | `oblique ${number}deg` | AliasValue  // Uses Primitive Formatter
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
  AliasValue // Uses Primitive Formatter
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
export type DisplayGridValue = 'grid' | 'inline-grid' | AliasValue // Uses Primitive Formatter
export type GridAutoFlowValue =  'row' | 'column' | 'row dense' | 'column dense' | AliasValue // Uses Primitive Formatter
export type GridValue = {
  display: DisplayGridValue
  'grid-template-columns'?: string[] | AliasValue
  'grid-template-rows'?: string[] | AliasValue
  'grid-template-areas'?: string[] | AliasValue
  'column-gap'?: GapValue
  'row-gap'?: GapValue
  'justify-items'?: AlignItemsValue
  'align-items'?: AlignItemsValue
  'justify-content'?: DistributeContentValue
  'align-content'?: DistributeContentValue
  'grid-auto-columns'?: PrimitiveArrayValue
  'grid-auto-rows'?: PrimitiveArrayValue
  'grid-auto-flow'?: GridAutoFlowValue
} | AliasValue
export type PercentageValue = `${number}:${number}` | `${number}%` | number | AliasValue // Uses Primitive Formatter
export type ShadowValue = {
  'color': ColorValue
  'offsetX': number | AliasValue
  'offsetY': number | AliasValue
  'blur': number | AliasValue
  'spread': number | AliasValue
} | AliasValue
export type TimingValue = `${string}s` | `${string}ms` | AliasValue // Uses Primitive Formatter
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
      values: string[] | AliasValue
    }
} | AliasValue
export type TypographyValue = {
  'font-family': FontFamilyValue
  'font-size':  number | AliasValue
  'font-weight': FontWeightValue
  'letter-spacing':  number | AliasValue | 'normal'
  'line-height':  number | AliasValue | 'normal'
} | AliasValue
export type TextTransformValue = 'none' | // Uses Primitive Formatter
  'capitalize' |
  'uppercase' |
  'lowercase' |
  'full-width' |
  'full-size-kana' |
  AliasValue

type $Extensions = string | number | boolean | Record<string, string | number  | boolean>

type $Value = PrimitiveValue |
PrimitiveArrayValue |
BorderValue |
DimensionValue |
FlexValue |
FontFamilyValue |
GradientValue |
GridValue |
ShadowValue |
TransitionValue |
TypographyValue 

type ValueAndType = 
  { 
    $type: 'alignItems' 
    $value: AlignItemsValue
  }|
  { 
    $type: 'border' 
    $value: BorderValue
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
    $type: 'displayFlex' 
    $value: DisplayFlexValue
  }|
  { 
    $type: 'distributeContent' 
    $value: DistributeContentValue
  }|
  { 
    $type: 'flex' 
    $value: FlexValue
  }|
  { 
    $type: 'flexDirection' 
    $value: FlexDirectionValue
  }|
  { 
    $type: 'displayFlex' 
    $value: DisplayFlexValue
  }|
  { 
    $type: 'flexWrap' 
    $value: FlexWrapValue 
  }|
  { 
    $type: 'fontFamily' 
    $value: FontFamilyValue
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
    $type: 'gap' 
    $value: GapValue
  }|
  { 
    $type: 'gradient' 
    $value: GradientValue
  }|
  { 
    $type: 'grid' 
    $value: GridValue
  }|
  { 
    $type: 'displayGrid' 
    $value: DisplayGridValue
  }|
  { 
    $type: 'gridAutoFlow' 
    $value: GridAutoFlowValue
  }|
  { 
    $type: 'percentage' 
    $value: PercentageValue
  }|
  { 
    $type: 'primitive' 
    $value: PrimitiveValue | PrimitiveArrayValue
  }|
  { 
    $type: 'shadow' 
    $value: ShadowValue
  }|
  { 
    $type: 'textTransform' 
    $value: TextTransformValue
  }|
  {
    $type: 'timing',
    $value: TimingValue
  } |
  { 
    $type: 'transition' 
    $value: TransitionValue
  }|
  { 
    $type: 'typography' 
    $value: TypographyValue
  }

// basic design token definition pulled from the https://design-tokens.github.io/community-group/format/#design-token-0
export type DesignToken  = {
  $extensions?: $Extensions
  $description?: string
} & ValueAndType

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

export type Formatter<T = $Value> = (args: {
  tokenPath: string[],
  $value: T
  _allTokens: DesignTokenGroup
  baseFontSize: number
}) => string



export type GetFormatter = (args: {
  tokenPath: string[],
  $value:  $Value
  _allTokens: DesignTokenGroup
  baseFontSize: number
  $type: string
}) => string

