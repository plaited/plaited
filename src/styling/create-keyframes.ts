import type { CSSKeyFrames, StyleFunctionKeyframe } from './styling.types.js'
import { createHash, getRule } from './styling.utils.js'

export const createKeyframes = (ident: string, frames: CSSKeyFrames): StyleFunctionKeyframe => {
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step = []
    for (const [prop, val] of Object.entries(props)) {
      step.push(getRule(prop, val))
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedIdent = ident + createHash(...arr)
  const getFrames = () => ({ stylesheet: [`@keyframes ${hashedIdent}{${arr.join('')}}`] })
  getFrames.id = hashedIdent
  return getFrames
}
