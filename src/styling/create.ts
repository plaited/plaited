import { CSS_RESERVED_KEYS } from './styling.constants.js'
import type { CreateParams, CSSClasses, NestedStatements, CSSProperties } from './styling.types.js'
import { createHash, isPrimitive, getRule } from './styling.utils'

const formatNestedRule = ({
  selector,
  key,
  map,
  rule,
  selectors,
}: {
  selector: string
  key: string
  map: Map<string, string>
  rule: string
  selectors: string[]
}) => {
  const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
  return map.set(key, `${selector}{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
}

const formatClasses = ({
  map,
  value,
  prop,
  selectors = [],
}: {
  map: Map<string, string>
  value: NestedStatements | CSSProperties[keyof CSSProperties]
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const key = `cls${createHash(prop, value, ...selectors)}`
    const selector = `.${key}`
    const rule = getRule(prop, value)
    if (!selectors.length) return map.set(key, `${selector}{${rule}}`)
    return formatNestedRule({ key, selector, map, rule, selectors })
  }
  if (value === undefined) return
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
      const nextSelectors = [...selectors]
      context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
      formatClasses({ map, value: val, prop, selectors: nextSelectors })
    }
  }
}

export const create = (classNames: CreateParams) =>
  Object.entries(classNames).reduce(
    (acc, [cls, props]) => {
      const map = new Map<string, string>()
      for (const [prop, value] of Object.entries(props)) formatClasses({ map, prop, value })
      const classes = [...map.keys()]
      const hash = createHash(...classes)
      const id = cls + hash
      acc[cls as keyof typeof classNames] = {
        class: [id, ...classes].join(' '),
        stylesheet: [...map.values()],
      }
      return acc
    },
    {} as CSSClasses<typeof classNames>,
  )
