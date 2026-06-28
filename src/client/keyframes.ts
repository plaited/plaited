import { InvalidKeyframeRefPositionError, MissingRegistryError, UnresolvedTokenRefError } from './css.errors.ts'
import { cssPropertyValueSchema } from './css.schemas.ts'
import type { CSSKeyFrames, CssRegistry, StyleFunctionKeyframe } from './css.types.ts'
import { createHash, getRule } from './css.utils.ts'

/** @internal Heuristic: is `val` a {$tokenRef} or {$keyframeRef} object? */
const isRefObj = (val: unknown): val is { $tokenRef: string } | { $keyframeRef: string } =>
  typeof val === 'object' &&
  val !== null &&
  ('$tokenRef' in (val as Record<string, unknown>) || '$keyframeRef' in (val as Record<string, unknown>))

/**
 * Creates a CSS `@keyframes` animation with automatic hash-based identifier generation.
 *
 * @param ident - Base identifier for the animation (will be hashed for uniqueness)
 * @param frames - Object defining animation keyframes
 * @param registry - Optional registry for resolving $tokenRef refs
 * @returns Object mapping the animation name to a StyleFunctionKeyframe
 */
export const createKeyframes = <I extends string, T extends CSSKeyFrames>(
  ident: I,
  frames: T,
  registry?: CssRegistry,
): Record<I, StyleFunctionKeyframe> => {
  const validateValue = (prop: string, val: unknown) => {
    if (!isRefObj(val)) {
      const schema = cssPropertyValueSchema(prop)
      const result = schema.safeParse(val)
      if (!result.success) {
        throw new Error(`Invalid value for CSS property ${JSON.stringify(prop)} in keyframes: ${val}`)
      }
    }
  }

  const resolveRef = (val: { $tokenRef: string } | { $keyframeRef: string }): string => {
    if ('$keyframeRef' in val) throw new InvalidKeyframeRefPositionError()
    if (!registry) throw new MissingRegistryError('tokenRef', val.$tokenRef)
    const entry = registry.tokens?.get(val.$tokenRef)
    if (!entry) throw new UnresolvedTokenRefError(val.$tokenRef)
    return entry.cssVar
  }

  const stylesheets: string[] = []
  const arr: string[] = []
  for (const [value, props] of Object.entries(frames)) {
    const step: string[] = []
    for (const [prop, val] of Object.entries(props)) {
      validateValue(prop, val)
      if (isRefObj(val)) {
        const resolved = resolveRef(val)
        step.push(getRule(prop, resolved))
      } else {
        step.push(getRule(prop, val as string | number))
      }
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedIdent = ident + createHash(...arr)
  stylesheets.push(`@keyframes ${hashedIdent}{${arr.join('')}}`)
  const getFrames = () => ({ stylesheets })
  getFrames.id = hashedIdent
  return {
    [ident]: getFrames,
  } as Record<I, StyleFunctionKeyframe>
}
