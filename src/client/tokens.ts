import { isTypeOf, kebabCase } from '../utils.ts'
import { MissingRegistryError, UnresolvedTokenRefError } from './css.errors.ts'
import type {
  CssRegistry,
  DesignToken,
  DesignTokenGroup,
  DesignTokenReference,
  DesignTokenReferences,
  DesignTokenScale,
  FunctionTokenValue,
} from './css.types.ts'
import { getRule, isTokenReference } from './css.utils.ts'

/**
 * @internal
 * Type guard to check if a value is a DesignToken object.
 */
const isToken = (token: unknown): token is DesignToken =>
  isTypeOf<Record<string, unknown>>(token, 'object') && Object.hasOwn(token, '$value')

/**
 * @internal
 * Type guard for serialized $tokenRef objects.
 */
const isTokenRefObj = (val: unknown): val is { $tokenRef: string } =>
  isTypeOf<Record<string, unknown>>(val, 'object') && Object.hasOwn(val, '$tokenRef')

/**
 * @internal
 * Resolves a token value, handling both in-memory DesignTokenReference callables
 * and serialized {$tokenRef} objects. Also handles literals (pass-through).
 */
const resolveValue = (
  $value: unknown,
  styles: string[],
  inProgress: Map<string, { cssVar: `var(--${string})`; stylesheets: string[] }>,
  registry?: CssRegistry,
): string | number => {
  if (isTokenReference($value as DesignTokenReference)) {
    const ref = $value as DesignTokenReference
    styles.push(...ref.stylesheets)
    return ref()
  }
  if (isTokenRefObj($value)) {
    const id = $value.$tokenRef
    // Check in-progress result map first (within-group alias)
    const local = inProgress.get(id)
    if (local) {
      styles.push(...local.stylesheets)
      return local.cssVar
    }
    // Then check registry
    if (!registry) throw new MissingRegistryError('tokenRef', id)
    const entry = registry.tokens?.get(id)
    if (!entry) throw new UnresolvedTokenRefError(id)
    styles.push(...entry.stylesheets)
    return entry.cssVar
  }
  return $value as string | number
}

/**
 * @internal
 * Type guard to check if a value is a function-based token value (e.g., calc(), rgb()).
 */
const isFunctionTokenValue = (value: unknown): value is FunctionTokenValue =>
  isTypeOf<Record<string, unknown>>(value, 'object') &&
  Object.hasOwn(value, '$function') &&
  Object.hasOwn(value, '$arguments')

/**
 * @internal
 * Generates a CSS function call string from a function token value.
 */
const getFunctionValue = (
  { $function, $arguments, $csv }: FunctionTokenValue,
  styles: string[],
  inProgress: Map<string, { cssVar: `var(--${string})`; stylesheets: string[] }>,
  registry?: CssRegistry,
) => {
  if (Array.isArray($arguments)) {
    return `${$function}(${$arguments.map((val) => resolveValue(val, styles, inProgress, registry)).join($csv ? ',' : ' ')})`
  }
  return `${$function}(${resolveValue($arguments, styles, inProgress, registry)})`
}

/**
 * @internal
 * Generates a CSS custom property declaration from a design token.
 */
const getTokenRule = ({
  cssVar,
  token,
  styles,
  inProgress,
  registry,
}: {
  cssVar: `--${string}`
  token: DesignToken
  styles: string[]
  inProgress: Map<string, { cssVar: `var(--${string})`; stylesheets: string[] }>
  registry?: CssRegistry
}): string => {
  const { $csv, $value } = token
  return Array.isArray($value)
    ? getRule(
        cssVar,
        $value
          .map((val) =>
            isFunctionTokenValue(val)
              ? getFunctionValue(val, styles, inProgress, registry)
              : resolveValue(val, styles, inProgress, registry),
          )
          .join($csv ? ',' : ' '),
      )
    : getRule(
        cssVar,
        isFunctionTokenValue($value)
          ? getFunctionValue($value, styles, inProgress, registry)
          : resolveValue($value, styles, inProgress, registry),
      )
}

/**
 * @internal
 * Creates a token reference function for a single token.
 */
const createTokenRef = (
  cssVar: `--${string}`,
  token: DesignToken,
  inProgress: Map<string, { cssVar: `var(--${string})`; stylesheets: string[] }>,
  registry?: CssRegistry,
): DesignTokenReference => {
  const styles: string[] = []
  styles.push(`:root{${getTokenRule({ cssVar, token, styles, inProgress, registry })}}`)
  const getRef = (): `var(--${string})` => `var(${cssVar})`
  getRef.stylesheets = styles
  return getRef
}

/**
 * Creates a design token system using CSS custom properties.
 *
 * @param ident - Base identifier for the token group
 * @param group - Object defining design tokens with their values
 * @param registry - Optional registry for resolving $tokenRef aliases
 * @returns Object mapping the identifier to token reference functions
 */
export const createTokens = <I extends string, T extends DesignTokenGroup>(
  ident: I,
  group: T,
  registry?: CssRegistry,
): Record<I, DesignTokenReferences<T>> => {
  const identKebab = kebabCase(ident)
  const inProgress = new Map<string, { cssVar: `var(--${string})`; stylesheets: string[] }>()

  const result = Object.entries(group).reduce(
    (acc, [prop, value]) => {
      const propKebab = kebabCase(prop)

      if (isToken(value)) {
        const cssVar: `--${string}` = `--${identKebab}-${propKebab}`
        const ref = createTokenRef(cssVar, value, inProgress, registry)
        inProgress.set(prop, { cssVar: `var(${cssVar})` as `var(--${string})`, stylesheets: ref.stylesheets })
        acc[prop as keyof T] = ref as DesignTokenReferences<T>[keyof T]
      } else {
        const scale = value as DesignTokenScale
        const scaleRefs = Object.entries(scale).reduce(
          (scaleAcc, [scaleKey, scaleToken]) => {
            const scaleKeyKebab = kebabCase(scaleKey)
            const cssVar: `--${string}` = `--${identKebab}-${propKebab}-${scaleKeyKebab}`
            const ref = createTokenRef(cssVar, scaleToken, inProgress, registry)
            inProgress.set(`${prop}.${scaleKey}`, {
              cssVar: `var(${cssVar})` as `var(--${string})`,
              stylesheets: ref.stylesheets,
            })
            scaleAcc[scaleKey] = ref
            return scaleAcc
          },
          {} as Record<string, DesignTokenReference>,
        )
        acc[prop as keyof T] = scaleRefs as DesignTokenReferences<T>[keyof T]
      }

      return acc
    },
    {} as DesignTokenReferences<T>,
  )

  return { [ident]: result } as Record<I, DesignTokenReferences<T>>
}
