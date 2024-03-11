import { hashString, kebabCase } from '@plaited/utils'
import { CSSProperties, CSSPropertiesObjectLiteral, CSSClasses, StyleObjects } from '../types.js'

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
  cls,
  stylesheets,
  value,
  prop,
  selectors = [],
}: {
  cls: string
  stylesheets: Map<keyof StyleObjects<T>, Map<string, string>>
  value: CSSPropertiesObjectLiteral<typeof prop> | CSSProperties[typeof prop]
  prop: string
  selectors?: string[]
}) => {
  const val = isPrimitive(value) ? value : value.default
  const map = stylesheets.get(cls) ?? stylesheets.set(cls, new Map<string, string>()).get(cls)!
  const [selector = '', ...atRules] = selectors
  if (val) {
    const hash = createClassHash(val, prop, selector, ...atRules)
    if (map.has(hash)) return
    const length = atRules.length
    map.set(
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
        cls,
        prop,
        stylesheets,
        value: rest[context as keyof typeof rest],
        selectors: [
          context.startsWith(':') ? selector + context : selector,
          ...(/^@(container|layer|media|supports)/.test(context) ? [...atRules, context] : atRules),
        ],
      })
    }
  }
}

/** A types safe function for creating hashed utility className(s) and stylesheet(s) */
export const createStyles = <T extends CSSClasses>(
  classNames: T,
): StyleObjects<T> & {
  $: (key: string) => string | undefined
} => {
  const stylesheets = new Map<keyof StyleObjects<T>, Map<string, string>>()
  for (const cls in classNames) {
    const props = classNames[cls]
    for (const prop in props) {
      const value = props[prop]
      if (isPrimitive(value)) {
        const map = stylesheets.get(cls) ?? stylesheets.set(cls, new Map<string, string>()).get(cls)!
        const hash = createClassHash(value, prop, '')
        const sheet = `.${hash}{${kebabCase(prop)}:${value}}`
        map.set(`${hash}`, sheet)
      } else {
        formatStyles<T>({
          cls,
          prop,
          stylesheets,
          value,
        })
      }
    }
  }
  const toRet: StyleObjects<T> = {} as StyleObjects<T>
  for (const [name, sheets] of stylesheets) {
    const classNames = [...sheets.keys()].join(' ')
    toRet[name] = {
      className: `${name as string}_${hashString(classNames)?.toString(36) ?? ''} ${classNames}`,
      stylesheet: [...sheets.values()],
    }
  }
  return {
    ...toRet,
    $(key: string) {
      const obj = toRet[key]
      if (obj) return obj.className.split(' ')[0]
    },
  }
}
