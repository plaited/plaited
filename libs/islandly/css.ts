// import { parsel } from './deps.ts'
// import { taggedWithPrimitives } from './utils.ts'
// import { hashString } from '../utils/hash.ts'
// type Primitive =
//   | number
//   | string
//   | boolean
//   | undefined
//   | null
//   | void

// export const css = (
//   strings: TemplateStringsArray,
//   ...expressions: Array<Primitive | Primitive[]>
// ) => {
//   const result = taggedWithPrimitives(strings, ...expressions)
//   const prefix = btoa(`${hashString(result)}`).replace(/[+/=]/g, '')
//   const parser = parsel
//   const { type, ...rest } = parsel.TOKENS
//   const TOKENS = {
//     ...rest,
//     nesting: /&/g,
//     nest: /@nest\b/g,
//     type,
//   }
//   parser.TOKENS = TOKENS
//   const tokens = parser.tokenize(result)
//   // const { transformed } = tokens.reduce(
//   //   () => {},
//   //   {
//   //     lastRawSelector: undefined,
//   //     lastTransformedSelector: undefined,
//   //     lastOpenBracket: undefined,
//   //     lastCloseBracket: undefined,
//   //     raw: [],
//   //     transformed: [],
//   //   },
//   // )
//   return {
//     styles: {},
//     stylesheet: '',
//   }
// }
