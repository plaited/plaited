import { CSS_RESERVED_KEYS } from './css.constants.js'
import type { CreateParams, CSSClasses, NestedStatements, CSSProperties, CustomPropertyObject } from './css.types.js'
import { createHash, isPrimitive, getRule, isCustomPropertyObject } from './css.utils.js'

const formatNestedRule = ({ set, rule, selectors }: { set: Set<string>; rule: string; selectors: string[] }) => {
  const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
  return set.add(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
}

const formatClasses = ({
  set,
  hostSet,
  value,
  prop,
  selectors = [],
}: {
  set: Set<string>
  hostSet: Set<string>
  value: NestedStatements | CSSProperties[keyof CSSProperties] | CustomPropertyObject
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const rule = getRule(prop, value)
    if (!selectors.length) return set.add(`{${rule}}`)
    return formatNestedRule({ set, rule, selectors })
  }
  if (isCustomPropertyObject(value)) {
    hostSet.add(value.stylesheet)
    const rule = getRule(prop, value.variable)
    if (!selectors.length) return set.add(`{${rule}}`)
    return formatNestedRule({ set, rule, selectors })
  }
  if (value === undefined) return
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
      const nextSelectors = [...selectors]
      context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
      formatClasses({ set, value: val, prop, selectors: nextSelectors, hostSet })
    }
  }
}

export const create = (classNames: CreateParams) =>
  Object.entries(classNames).reduce(
    (acc, [cls, props]) => {
      const set = new Set<string>()
      const hostSet = new Set<string>()
      for (const [prop, value] of Object.entries(props)) formatClasses({ set, prop, value, hostSet })
      const classes: string[] = []
      const stylesheet = [...hostSet]
      for (const sheet of set) {
        const cls = `cls${createHash(sheet)}`
        classes.push(cls)
        stylesheet.push(`.${cls}${sheet}`)
      }
      acc[cls] = {
        className: [cls, ...classes],
        stylesheet,
      }
      return acc
    },
    {} as CSSClasses<typeof classNames>,
  )
