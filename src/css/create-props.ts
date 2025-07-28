import { kebabCase } from '../utils.js'

import type {
  CustomPropertyRegistration,
  CustomPropertyRegistrationGroup,
  CustomPropertyRegistrationGroupEntries,
  CustomProperties,
  CustomProperty,
  CustomPropertyObject,
  CSSProps,
} from './css.types.js'

const isCustomPropertyRegistration = (
  prop: CustomPropertyRegistration | CustomPropertyRegistrationGroup,
): prop is CustomPropertyRegistration => {
  const length = Object.keys(prop).length
  if (length === 2) {
    return Object.hasOwn(prop, 'syntax') && Object.hasOwn(prop, 'inherits')
  } else if (length === 3) {
    return Object.hasOwn(prop, 'syntax') && Object.hasOwn(prop, 'inherits') && Object.hasOwn(prop, 'initialValue')
  } else {
    return false
  }
}

const formatAtProp = (
  property: CustomProperty,
  { syntax, inherits, initialValue }: CustomPropertyRegistration,
): CustomPropertyObject => ({
  $: '🍬',
  variable: `var(${property})`,
  stylesheet: `@property ${property} {syntax:"${syntax}";inherits:${inherits};${initialValue ? `initial-value:${initialValue};` : ''}}`,
})

const formatProps = <T extends CustomPropertyRegistrationGroupEntries>({
  props,
  path = [],
}: {
  props: T
  path?: string[]
}): CustomProperties => {
  const getters: CustomProperties = {}
  for (const [key, value] of props) {
    const kebabKey = kebabCase(key)
    const nextPath = [...path, kebabKey]
    if (isCustomPropertyRegistration(value)) {
      const property: CustomProperty = `--${nextPath.join('-')}`
      getters[key] = formatAtProp(property, value)
      continue
    }
    getters[key] = formatProps({
      path: nextPath,
      props: Object.entries(value),
    })
  }
  return getters
}

export const createProps = <T extends CustomPropertyRegistrationGroup>(props: T) =>
  formatProps({ props: Object.entries(props) }) as CSSProps<T>
