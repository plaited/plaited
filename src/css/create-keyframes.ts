import type { CSSKeyFrames, StyleFunctionKeyframe } from './css.types.js'
import { createHash, getRule, isPrimitive } from './css.utils.js'

export const createKeyframes = (ident: string, frames: CSSKeyFrames): StyleFunctionKeyframe => {
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step = []
    for (const [prop, val] of Object.entries(props)) {
      if (isPrimitive(val)) {
        step.push(getRule(prop, val))
        continue
      }
      arr.push(val.stylesheet)
      step.push(getRule(prop, val.variable))
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedIdent = ident + createHash(...arr)
  const getFrames = () => ({ stylesheet: [`@keyframes ${hashedIdent}{${arr.join('')}}`] })
  getFrames.id = hashedIdent
  return getFrames
}
