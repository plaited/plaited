import { CSS_RESERVED_KEYS } from './styling.constants'
import type {
  StylesObjectWithoutClass,
  CSSProperties,
  CreatePartsParams,
  NestedPartStatements,
} from './styling.types.js'
import { isPrimitive, getRule } from './styling.utils.js'

const formatNestedStatements = ({
  set,
  prop,
  value,
  selectors = [],
  host,
}: {
  set: Set<string>
  prop: string
  value: CSSProperties[keyof CSSProperties] | NestedPartStatements
  selectors?: string[]
  host: string
}) => {
  if (isPrimitive(value)) {
    const regex = /^(@|\[part=)/
    const arr = selectors.map((str) => (regex.test(str) ? `${str}{` : `&${str}{`))
    set.add(`${host}{${arr.join('')}${getRule(prop, value)}${'}'.repeat(arr.length)}}`)
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

const formatParts = ({ props, part, set }: { props: CreatePartsParams[string]; set: Set<string>; part: string }) => {
  const selectors = [`[part="${part}"]`]
  for (const [prop, value] of Object.entries(props)) {
    if (isPrimitive(value)) {
      formatNestedStatements({
        set,
        prop,
        value,
        selectors,
        host: ':host',
      })
      continue
    }

    const { $compoundSelectors, ...rest } = value
    formatNestedStatements({
      set,
      prop,
      value: rest,
      selectors,
      host: ':host',
    })

    if ($compoundSelectors) {
      for (const [slector, value] of Object.entries($compoundSelectors)) {
        formatNestedStatements({
          set,
          prop,
          value,
          selectors,
          host: `:host(${slector})`,
        })
      }
    }
  }
}

export const createParts = (parts: CreatePartsParams): StylesObjectWithoutClass => {
  const set = new Set<string>()
  for (const [part, props] of Object.entries(parts)) {
    formatParts({
      set,
      part,
      props,
    })
  }
  return {
    stylesheet: [...set],
  }
}
