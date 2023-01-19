import { $Value } from '../token-transform-util/types.js'

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
