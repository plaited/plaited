import { CSS_RESERVED_KEYS } from './css.constants.js'
import type {
  NestedStatements,
  CSSProperties,
  CreateHostParams,
  HostStylesObject,
  DesignTokenReference,
} from './css.types.js'
import { isTypeOf } from '../utils.js'
import { isTokenReference, getRule } from './css.utils.js'

const isPrimitive = (val: string | number | unknown): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

// host function (previously createHost in create-host.ts)
const formatHostStatement = ({
  styles,
  prop,
  value,
  selectors = [],
  host,
}: {
  styles: string[]
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedStatements | DesignTokenReference
  selectors?: string[]
  host: string
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    for (const [key, val] of Object.entries(value)) {
      if (key === CSS_RESERVED_KEYS.$default) {
        formatHostStatement({
          styles,
          prop,
          value: val,
          selectors,
          host,
        })
        continue
      }
      formatHostStatement({
        styles,
        prop,
        value: val,
        selectors: [...selectors, key],
        host,
      })
    }
  } else {
    const isToken = isTokenReference(value)
    isToken && styles.push(...value.styles)
    const arr = selectors.map((str) => `${str}{`)
    styles.push(`${host}{${arr.join('')}${getRule(prop, isToken ? value() : value)}${'}'.repeat(arr.length)}}`)
  }
}

export const hostStyles = (props: CreateHostParams): HostStylesObject => {
  const styles: string[] = []
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value) || isTokenReference(value)) {
      formatHostStatement({
        styles,
        prop,
        value,
        host: ':host',
      })
      continue
    }

    // Check if value is an object and has $compoundSelectors property
    const { $compoundSelectors, ...rest } = value
    if (Object.keys(rest).length) {
      formatHostStatement({
        styles,
        prop,
        value: rest,
        host: ':host',
      })
    }

    if ($compoundSelectors) {
      for (const [selector, value] of Object.entries($compoundSelectors)) {
        formatHostStatement({
          styles,
          prop,
          value,
          host: `:host(${selector})`,
        })
      }
    }
  }

  return {
    stylesheets: styles,
  }
}
