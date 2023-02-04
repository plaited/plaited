import { element } from '../island/mod.ts'
import { SSRFunc } from './types.ts'

export const ssr: SSRFunc = (tag, template) => element({ tag, template })
