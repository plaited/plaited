import { hashString, kebabCase } from '@plaited/utils'
import { CSSProperties, CSSPropertiesObjectLiteral, CSSClasses, StyleObject } from '../types.js'

const createClassHash = (...args: (string | number)[]) => 'p' + hashString(args.join(' '))?.toString(36)

const isPrimitive = (val: string | number | CSSPropertiesObjectLiteral<string>): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

const handleAtRules = ({
  prop,
  val,
  hash,
  selector,
  atRules,
  last,
}: {
  prop: string
  val: string | number
  hash: string
  selector: string
  atRules: string[]
  last: number
}) =>
  atRules.reduceRight<string>((acc, cur, i) => {
    if (i === last) return `${cur}{.${hash}${selector}{${kebabCase(prop)}:${val}}}`
    return `${cur}{${acc}}`
  }, '')

const formatStyles = <T extends CSSClasses>({
  stylesheets,
  value,
  prop,
  selectors = [],
}: {
  stylesheets: Map<string, string>
  value: CSSPropertiesObjectLiteral<typeof prop> | CSSProperties[typeof prop]
  prop: string
  selectors?: string[]
}) => {
  const val = isPrimitive(value) ? value : value.default
  const [selector = '', ...atRules] = selectors
  if (val) {
    const hash = createClassHash(val, prop, selector, ...atRules)
    if (stylesheets.has(hash)) return
    const length = atRules.length
    stylesheets.set(
      hash,
      length ?
        handleAtRules({
          prop,
          val,
          hash,
          selector,
          atRules,
          last: length - 1,
        })
      : `.${hash}${selector}{${kebabCase(prop)}:${val}}`,
    )
  }
  if (!isPrimitive(value)) {
    const { default: _, ...rest } = value
    for (const context in rest) {
      formatStyles<T>({
        prop,
        stylesheets,
        value: rest[context as keyof typeof rest],
        selectors: [
          /^(:|\[)/.test(context) ? selector + context : selector,
          ...(/^@(container|layer|media|supports)/.test(context) ? [...atRules, context] : atRules),
        ],
      })
    }
  }
}

/** A types safe function for creating hashed utility className(s) and stylesheet(s) */
export const createStyles = (
  props: CSSClasses,
): StyleObject => {
  const stylesheets = new Map<string, string>()
  for (const prop in props) {
    const value = props[prop]
    if (isPrimitive(value)) {
      const hash = createClassHash(value, prop, '')
      const sheet = `.${hash}{${kebabCase(prop)}:${value}}`
      stylesheets.set(`${hash}`, sheet)
    } else {
      formatStyles({
        prop,
        stylesheets,
        value,
      })
    }
  }
  return {
    className: [...stylesheets.keys()],
    stylesheet: [...stylesheets.values()]
  }
}
