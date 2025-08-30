import { CSS_RESERVED_KEYS } from './css.constants.js'
import type {
  DesignTokenGroup,
  DesignToken,
  NestedDesignTokenStatements,
  DesignTokenReferences,
  DesignTokenReference,
  FunctionTokenValue,
} from './css.types.js'
import { kebabCase, isTypeOf } from '../utils.js'
import { isTokenReference, getRule } from './css.utils.js'

const isToken = (token: unknown): token is DesignToken =>
  isTypeOf<Record<string, unknown>>(token, 'object') && Object.hasOwn(token, '$value')

const getTokenValue = ($value: string | number | DesignTokenReference, styles: string[]) => {
  if (isTokenReference($value)) {
    styles.push(...$value.styles)
    return $value()
  }
  return $value
}

const isFunctionTokenValue = (value: unknown): value is FunctionTokenValue =>
  isTypeOf<Record<string, unknown>>(value, 'object') &&
  Object.hasOwn(value, '$function') &&
  Object.hasOwn(value, '$arguments')

const getFunctionValue = ({ $function, $arguments, $csv }: FunctionTokenValue, styles: string[]) => {
  if (Array.isArray($arguments)) {
    return `${$function}(${$arguments.map((val) => getTokenValue(val, styles)).join($csv ? ',' : ' ')})`
  }
  return `${$function}(${getTokenValue($arguments, styles)})`
}

const getToken = ({
  cssVar,
  token,
  styles,
}: {
  cssVar: `--${string}`
  token: DesignToken
  styles: string[]
}): string => {
  const { $csv, $value } = token
  return Array.isArray($value) ?
      getRule(
        cssVar,
        $value
          .map((val) => (isFunctionTokenValue(val) ? getFunctionValue(val, styles) : getTokenValue(val, styles)))
          .join($csv ? ',' : ' '),
      )
    : getRule(cssVar, isFunctionTokenValue($value) ? getFunctionValue($value, styles) : getTokenValue($value, styles))
}

// host function (previously createHost in create-host.ts)
const formatTokenStatement = ({
  styles,
  cssVar,
  token,
  selectors = [],
  host,
}: {
  styles: string[]
  cssVar: `--${string}`
  token: DesignToken | NestedDesignTokenStatements
  selectors?: string[]
  host: string
}) => {
  if (isToken(token)) {
    const arr = selectors.map((str) => `${str}{`)
    styles.push(`${host}{${arr.join('')}${getToken({ cssVar, token, styles })}${'}'.repeat(arr.length)}}`)
    return
  }
  for (const [key, val] of Object.entries(token)) {
    if (key === CSS_RESERVED_KEYS.$default) {
      formatTokenStatement({
        styles,
        cssVar,
        token: val,
        selectors,
        host,
      })
      continue
    }
    formatTokenStatement({
      styles,
      cssVar,
      token: val,
      selectors: [...selectors, key],
      host,
    })
  }
}

export const tokens = <T extends DesignTokenGroup>(ident: string, group: T) =>
  Object.entries(group).reduce((acc, [prop, value]) => {
    const cssVar: `--${string}` = `--${kebabCase(ident)}-${kebabCase(prop)}`
    const styles: string[] = []
    if (isToken(value)) {
      formatTokenStatement({
        styles,
        cssVar,
        token: value,
        host: ':host',
      })
    } else {
      // Check if value is an object and has $compoundSelectors property
      const { $compoundSelectors, ...rest } = value
      if (Object.keys(rest).length) {
        formatTokenStatement({
          styles,
          cssVar,
          token: rest,
          host: ':host',
        })
      }

      if ($compoundSelectors) {
        for (const [selector, value] of Object.entries($compoundSelectors)) {
          formatTokenStatement({
            styles,
            cssVar,
            token: value,
            host: `:host(${selector})`,
          })
        }
      }
    }
    const getRef = (): `var(--${string})` => `var(${cssVar})`
    getRef.styles = styles
    acc[prop as keyof T] = getRef
    return acc
  }, {} as DesignTokenReferences<T>)
