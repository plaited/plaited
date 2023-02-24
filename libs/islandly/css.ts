// import { parsel } from '../deps.ts'
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
//   const suffix = btoa(`${hashString(result)}`).replace(/[+/=]/g, '')
//   const tokens = parsel.tokenize(result)
//   tokens?.map()
//   return {
//     classes: {},
//     styles: '',
//   }
// }
