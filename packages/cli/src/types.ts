type $PrimitiveValue = string | number
type $ValueRecord = Record<string, $PrimitiveValue | $PrimitiveValue[]>
type $Extensions = string | number | boolean | Record<string, string | number  | boolean>

type $Value = $PrimitiveValue | $ValueRecord | $ValueRecord[]

type TokenTypes = 
  'border' |
  'color' |
  'cubicBezier' |
  'dimension' |
  'duration' |
  'flex' |
  'fontFamily' |
  'fontSize' |
  'fontStyle' |
  'fontWeight' |
  'gradient' |
  'grid' |
  'letterSpacing' |
  'lineHeight' |
  'number' |
  'percentage' |
  'shadow' |
  'strokeStyle' |
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
}) => string

export type FormatterObject = Record<TokenTypes, Formatter>

