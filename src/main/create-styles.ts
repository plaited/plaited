import { CSS_RESERVED_KEYS } from './css.constants.js'
import type { CreateParams, ClassNames, NestedStatements, CSSProperties, DesignTokenReference } from './css.types.js'
import { isTypeOf } from '../utils.js'
import { isTokenReference, getRule, createHash } from './css.utils.js'

const formatClassStatement = ({
  styles,
  hostStyles,
  value,
  prop,
  selectors = [],
}: {
  styles: string[]
  hostStyles: string[]
  value: NestedStatements | CSSProperties[keyof CSSProperties] | DesignTokenReference
  prop: string
  selectors?: string[]
}) => {
  if (isTypeOf<NestedStatements>(value, 'object')) {
    const arr = Object.entries(value)
    const length = arr.length
    for (let i = 0; i < length; i++) {
      const [context, val] = arr[i]
      if (context === CSS_RESERVED_KEYS.$default || /^(:|\[|@)/.test(context)) {
        const nextSelectors = [...selectors]
        context !== CSS_RESERVED_KEYS.$default && nextSelectors.push(context)
        formatClassStatement({ styles, value: val, prop, selectors: nextSelectors, hostStyles })
      }
    }
  } else {
    const isToken = isTokenReference(value)
    isToken && hostStyles.push(...value.styles)
    const rule = getRule(prop, isToken ? value() : value)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    styles.push(`{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
}

export const createStyles = <T extends CreateParams>(classNames: T): ClassNames<T> =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const styles: string[] = []
    const hostStyles: string[] = []
    for (const [prop, value] of Object.entries(props)) formatClassStatement({ styles, hostStyles, prop, value })
    const classes: string[] = []
    const stylesheets: string[] = hostStyles
    for (const sheet of styles) {
      const cls = `cls${createHash(sheet)}`
      classes.push(cls)
      stylesheets.push(`.${cls}${sheet}`)
    }
    acc[cls as keyof T] = {
      classNames: [cls, ...classes],
      stylesheets,
    }
    return acc
  }, {} as ClassNames<T>)
