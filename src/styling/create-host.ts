import type { CreateHostParams, StylesObjectWithoutClass } from './styling.types.js'
import { isPrimitive, getRule } from './styling.utils.js'

const formatNestedRule = ({ set, rule, selectors }: { set: Set<string>; rule: string; selectors: string[] }) => {
  const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
  set.add(`${arr.join('')}${rule}${'}'.repeat(arr.length)}`)
}

const addPartStylesheet = ({
  set,
  $parts,
  prop,
  selector,
}: {
  set: Set<string>
  selector: string
  prop: string
  $parts: Record<string, string | number>
}) => {
  for (const part in $parts) {
    const value = $parts[part]
    formatNestedRule({
      set,
      rule: getRule(prop, value),
      selectors: [selector, `[part="${part}"]`],
    })
  }
}

export const createHost = (props: CreateHostParams): StylesObjectWithoutClass => {
  const set = new Set<string>()
  for (const prop in props) {
    const value = props[prop]
    if (isPrimitive(value)) {
      set.add(`:host{${getRule(prop, value)}`)
      continue
    }

    const { $parts, $compoundSelectors, $default } = value

    $default && set.add(`:host{${getRule(prop, $default)}`)

    $parts &&
      addPartStylesheet({
        prop,
        set,
        $parts,
        selector: ':host',
      })

    if ($compoundSelectors) {
      for (const selector in $compoundSelectors) {
        const value = $compoundSelectors[selector]
        if (isPrimitive(value)) {
          formatNestedRule({
            set,
            rule: getRule(prop, value),
            selectors: [`:host(${$compoundSelectors})`],
          })
          continue
        }
        const { $default, $parts } = value
        $default &&
          formatNestedRule({
            set,
            rule: getRule(prop, $default),
            selectors: [`:host(${$compoundSelectors})`],
          })
        $parts &&
          addPartStylesheet({
            prop,
            set,
            $parts,
            selector: `:host(${$compoundSelectors})`,
          })
      }
    }
  }
  return {
    stylesheet: [...set],
  }
}
