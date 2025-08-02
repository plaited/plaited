import { kebabCase, isTypeOf } from '../utils.js'

import { CUSTOM_PROPERTY_OBJECT_IDENTIFIER } from './css.constants.js'
import type {
  DesignToken,
  CustomProperty,
  DesignTokenObject,
  DesignTokens,
  DesignTokenValueList,
  NestedTokenStatements,
  CreateTokens,
} from './css.types.js'

const isDesignToken = (prop: DesignToken | NestedTokenStatements): prop is DesignToken => {
  const length = Object.keys(prop).length
  if (length === 1) {
    return Object.hasOwn(prop, '$value')
  } else if (length === 2) {
    return Object.hasOwn(prop, '$value') && Object.hasOwn(prop, '$csv')
  } else {
    return false
  }
}

const isDesigntokenObject = (obj: unknown): obj is DesignTokenObject =>
  isTypeOf<Record<string, unknown>>(obj, 'object') && obj?.$ === CUSTOM_PROPERTY_OBJECT_IDENTIFIER

const handleTokenArray = ({
  stylesheet,
  $value,
  $csv,
}: {
  stylesheet: string[]
  $value: DesignTokenValueList['$value']
  $csv: DesignTokenValueList['$csv']
}) =>
  $value
    .map((val) => {
      if (isDesigntokenObject(val)) {
        stylesheet.push(...val.stylesheet)
        return val.variable
      }
      return `${val}`
    })
    .join($csv ? ',' : ' ')

const handleTokenObject = (obj: DesignTokenObject, stylesheet: string[]) => {
  stylesheet.push(...obj.stylesheet)
  return obj.variable
}
const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))
const getRule = (prop: string, value: string | number) => `${caseProp(prop)}:${value};`
const getFunc = (func: string, value: string | number) => `${func}(${value})`

const formatTokenStatement = ({
  prop,
  token,
  selectors = [],
  stylesheet,
}: {
  prop: CustomProperty
  token: DesignToken | NestedTokenStatements
  selectors?: string[]
  stylesheet: string[]
}) => {
  if (isDesignToken(token)) {
    const { $csv, $value } = token
    // const ident: CustomProperty = `--${[kebabCase(group), kebabCase(prop)].join('-')}`
    const rule =
      isTypeOf<string>($value, 'string') || isTypeOf<number>($value, 'number') ? getRule(prop, $value)
      : isDesigntokenObject($value) ? getRule(prop, handleTokenObject($value, stylesheet))
      : Array.isArray($value) ? getRule(prop, handleTokenArray({ stylesheet, $value, $csv }))
      : Array.isArray($value.arguments) ?
        getRule(prop, getFunc($value.function, handleTokenArray({ stylesheet, $value: $value.arguments, $csv })))
      : isDesigntokenObject($value.arguments) ?
        getRule(prop, getFunc($value.function, handleTokenObject($value.arguments, stylesheet)))
      : getRule(prop, getFunc($value.function, $value.arguments))
    if (!selectors.length) {
      stylesheet.push(`:host{${rule}}`)
    } else {
      const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
      stylesheet.push(`:host{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
    }
    return
  }
  for (const [key, value] of Object.entries(token)) {
    formatTokenStatement({
      prop,
      token: value,
      stylesheet,
      selectors: [...selectors, key],
    })
  }
}

const tokens = <T extends CreateTokens>(tokens: T) =>
  Object.entries(tokens).reduce(
    (acc, [group, props]) => {
      const tokens: { [key: string]: DesignTokenObject } = {}
      for (const [key, token] of Object.entries(props)) {
        const prop: CustomProperty = `--${[kebabCase(group), kebabCase(key)].join('-')}`
        const stylesheet: string[] = []
        formatTokenStatement({
          prop,
          stylesheet,
          token,
        })
        tokens[key] = {
          $: CUSTOM_PROPERTY_OBJECT_IDENTIFIER,
          stylesheet,
          variable: `var(${prop})`,
        }
      }
      acc[group] = tokens
      return acc
    },
    {} as Record<string, { [key: string]: DesignTokenObject }>,
  ) as DesignTokens<T>
