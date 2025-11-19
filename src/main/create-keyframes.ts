import type { CSSKeyFrames, StyleFunctionKeyframe } from './css.types.js'
import { isTokenReference, getRule, createHash } from './css.utils.js'

/**
 * Creates a CSS `@keyframes` animation with automatic hash-based identifier generation.
 * Returns a function that provides the keyframe stylesheets and a unique animation name.
 * Supports design token references for animated property values.
 *
 * @param ident - Base identifier for the animation (will be hashed for uniqueness)
 * @param frames - Object defining animation keyframes using 'from', 'to', or percentage offsets
 * @returns Function that returns stylesheets object, with an `id` property containing the unique animation name
 *
 * @example Simple fade-in animation
 * ```ts
 * const fadeIn = createKeyframes('fade-in', {
 *   from: { opacity: 0 },
 *   to: { opacity: 1 }
 * });
 *
 * // Use in styles:
 * const animated = createStyles({
 *   element: {
 *     animation: `${fadeIn.id} 300ms ease-in`
 *   }
 * });
 * ```
 *
 * @example Multi-step animation with percentages
 * ```ts
 * const bounce = createKeyframes('bounce', {
 *   '0%': { transform: 'translateY(0)' },
 *   '50%': { transform: 'translateY(-20px)' },
 *   '100%': { transform: 'translateY(0)' }
 * });
 * ```
 *
 * @example Using design tokens in animations
 * ```ts
 * const tokens = createTokens('colors', {
 *   primary: { $value: 'blue' },
 *   secondary: { $value: 'lightblue' }
 * });
 *
 * const pulse = createKeyframes('pulse', {
 *   '0%': { backgroundColor: tokens.primary },
 *   '50%': { backgroundColor: tokens.secondary },
 *   '100%': { backgroundColor: tokens.primary }
 * });
 * ```
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
