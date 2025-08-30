import type { CSSKeyFrames, StyleFunctionKeyframe } from './css.types.js'
import { isTokenReference, getRule, createHash } from './css.utils.js'

// keyframes function (previously createKeyframes in create-keyframes.ts)
export const keyframes = (ident: string, frames: CSSKeyFrames): StyleFunctionKeyframe => {
  const stylesheets: string[] = []
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step = []
    for (const [prop, val] of Object.entries(props)) {
      const isToken = isTokenReference(val)
      isToken && stylesheets.push(...val.styles)
      step.push(getRule(prop, isToken ? val() : val))
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedIdent = ident + createHash(...arr)
  stylesheets.push(`@keyframes ${hashedIdent}{${arr.join('')}}`)
  const getFrames = () => ({ stylesheets })
  getFrames.id = hashedIdent
  return getFrames
}
