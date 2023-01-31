import { element } from '../template.ts'
import { SSRFunc } from './types.ts'

export const ssr:SSRFunc = (tag, template) => element({ tag, template })
