import { CSS_RESERVED_KEYS } from './css.constants'
import type {
  CreateHostParams,
  NestedStatements,
  CSSProperties,
  CustomPropertyObject,
  HostStylesObject,
} from './css.types.js'
import { isPrimitive, getRule, isCustomPropertyObject } from './css.utils.js'

const formatNestedStatements = ({
  set,
  prop,
  value,
  selectors = [],
  host,
}: {
  set: Set<string>
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedStatements | CustomPropertyObject
  selectors?: string[]
  host: string
}) => {
  if (isPrimitive(value)) {
    const arr = selectors.map((str) => `${str}{`)
    set.add(`${host}{${arr.join('')}${getRule(prop, value)}${'}'.repeat(arr.length)}}`)
    return
  }
  if (isCustomPropertyObject(value)) {
    const arr = selectors.map((str) => `${str}{`)
    set.add(value.stylesheet)
    set.add(`${host}{${arr.join('')}${getRule(prop, value.variable)}${'}'.repeat(arr.length)}}`)
    return
  }
  if (value === undefined) return
  for (const [key, val] of Object.entries(value)) {
    if (key === CSS_RESERVED_KEYS.$default) {
      formatNestedStatements({
        set,
        prop,
        value: val,
        selectors,
        host,
      })
      continue
    }
    formatNestedStatements({
      set,
      prop,
      value: val,
      selectors: [...selectors, key],
      host,
    })
  }
}

export const createHost = (props: CreateHostParams): HostStylesObject => {
  const set = new Set<string>()
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value) || isCustomPropertyObject(value)) {
      formatNestedStatements({
        set,
        prop,
        value,
        host: ':host',
      })
      continue
    }

    const { $compoundSelectors, ...rest } = value
    formatNestedStatements({
      set,
      prop,
      value: rest,
      host: ':host',
    })

    if ($compoundSelectors) {
      for (const [slector, value] of Object.entries($compoundSelectors)) {
        formatNestedStatements({
          set,
          prop,
          value,
          host: `:host(${slector})`,
        })
      }
    }
  }
  return {
    stylesheet: [...set],
  }
}
