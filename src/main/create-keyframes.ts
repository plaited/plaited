import type { CSSKeyFrames, StyleFunctionKeyframe } from './css.types.ts'
import { createHash, getRule, isTokenReference } from './css.utils.ts'

/**
 * Creates a CSS `@keyframes` animation with automatic hash-based identifier generation.
 * Returns a function that provides the keyframe stylesheets and a unique animation name.
 * Supports design token references for animated property values.
 *
 * @param ident - Base identifier for the animation (will be hashed for uniqueness)
 * @param frames - Object defining animation keyframes using 'from', 'to', or percentage offsets
 * @returns Function that returns stylesheets object, with an `id` property containing the unique animation name
 *
 * @remarks
 * - The animation identifier is automatically hashed to prevent naming collisions
 * - Design token styles are included in the returned stylesheets array
 * - The returned function's `id` property should be used in `animation` or `animation-name` CSS properties
 * - Keyframes can use 'from', 'to', or any percentage value (e.g., '25%', '75%')
 *
 * @see {@link CSSKeyFrames} for the keyframe definition structure
 * @see {@link StyleFunctionKeyframe} for the return type
 * @see {@link createTokens} for design token creation
 */
export const createKeyframes = (ident: string, frames: CSSKeyFrames): StyleFunctionKeyframe => {
  const stylesheets: string[] = []
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step = []
    for (const [prop, val] of Object.entries(props)) {
      const isToken = isTokenReference(val)
      isToken && stylesheets.push(...val.stylesheets)
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
