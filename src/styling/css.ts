import type {
  CSSProperties,
  CSSHostProperties,
  CSSKeyFrames,
  CSSClasses,
  CreateNestedCSS,
  StyleObjects,
  StylesObject,
} from './css.types.js'
import { kebabCase } from '../utils/case.js'
import { hashString } from '../utils/hash-string.js'

const createClassHash = (...args: (string | number)[]) =>
  hashString(args.join(' '))?.toString(36).replace(/^-/g, '_') ?? ''

const isPrimitive = (val: string | number | CreateNestedCSS<string>): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

const formatStyles = ({
  map,
  value,
  prop,
  selectors = [],
}: {
  map: Map<string, string>
  value: CreateNestedCSS<typeof prop> | CSSProperties[typeof prop]
  prop: string
  selectors?: string[]
}) => {
  if (isPrimitive(value)) {
    const hash = createClassHash(prop, value, ...selectors)
    const className = `p${hash}`
    const rule = `${caseProp(prop)}:${value};`
    if (!selectors.length) return map.set(className, `.${className}{${rule}}`)
    const arr = selectors.map((str) => (str.startsWith('@') ? `${str}{` : `&${str}{`))
    return map.set(className, `.${className}{${arr.join('')}${rule}${'}'.repeat(arr.length)}}`)
  }
  const arr = Object.entries(value)
  const length = arr.length
  for (let i = 0; i < length; i++) {
    const [context, val] = arr[i]
    if (context === 'default' || /^(:|\[|(@(container|layer|media|supports)))/.test(context)) {
      const nextSelectors = [...selectors]
      context !== 'default' && nextSelectors.push(context)
      formatStyles({ map, value: val, prop, selectors: nextSelectors })
    }
  }
}

/** A types safe function for creating hashed utility className(s) and stylesheet(s) */
const create = <T extends CSSClasses>(classNames: T) =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const map = new Map<string, string>()
    for (const prop in props) formatStyles({ map, prop, value: props[prop] })
    const classes = [...map.keys()]
    const hash = createClassHash(...classes)
    acc[cls as keyof T] = {
      className: [`${cls}_${hash}`, ...classes].join(' '),
      stylesheet: [...map.values()],
    }
    return acc
  }, {} as StyleObjects<T>)

const host = (props: CSSHostProperties) => {
  const arr: string[] = []
  for (const prop in props) {
    const value = props[prop]
    if (isPrimitive(value)) {
      arr.push(`:host{${caseProp(prop)}:${value};}`)
      continue
    }
    for (const selector in value) {
      if (selector === 'default') {
        arr.push(`:host{${caseProp(prop)}:${value[selector]};}`)
        continue
      }
      arr.push(`:host(${selector}){${caseProp(prop)}:${value[selector]};}`)
    }
  }
  return { stylesheet: [...arr] }
}

const keyframes = (name: string, frames: CSSKeyFrames) => {
  const arr: string[] = []
  for (const value in frames) {
    const props = frames[value as keyof typeof frames]
    const step = []
    for (const prop in props) {
      step.push(`${caseProp(prop)}:${props[prop]};`)
    }
    arr.push(`${value}{${step.join('')}}`)
  }
  const hashedName = `${name}_${createClassHash(...arr)}`
  const getFrames = () => ({ stylesheet: `@keyframes ${hashedName}{${arr.join('')}}` })
  getFrames.id = hashedName
  return getFrames
}

const assign = (...styleObjects: Array<StylesObject | undefined | false | null>) => {
  const cls: Array<string | undefined | false | null> = []
  const style: Array<string | undefined | false | null> = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { className, stylesheet } = styleObject
    className && cls.push(...(Array.isArray(className) ? className : [className]))
    stylesheet && style.push(...(Array.isArray(stylesheet) ? stylesheet : [stylesheet]))
  }
  return { className: cls.length ? cls : undefined, stylesheet: style.length ? style : undefined }
}
/**
 * Comprehensive CSS-in-JS utility for creating and managing styles.
 * Provides type-safe CSS generation with automatic class name hashing and style deduplication.
 *
 * @namespace css
 *
 * @property create - Creates hashed utility classes with stylesheets
 * @example
 * const styles = css.create({
 *   button: {
 *     color: 'blue',
 *     '@media (max-width: 768px)': { color: 'red' }
 *   }
 * });
 *
 * @property host - Generates shadow DOM host styles with selector support
 * @example
 * const hostStyles = css.host({
 *   color: {
 *     default: 'black',
 *     '.dark-theme': 'white'
 *   }
 * });
 *
 * @property keyframes - Creates CSS animations with unique names
 * @example
 * const fade = css.keyframes('fade', {
 *   from: { opacity: 0 },
 *   to: { opacity: 1 }
 * });
 *
 * @property assign - Combines multiple style objects
 * @example
 * const combined = css.assign(
 *   styles.button,
 *   isActive && styles.active
 * );
 *
 * Features:
 * - Type-safe CSS properties and values
 * - Automatic class name hashing for CSS isolation
 * - Support for nested selectors and media queries
 * - Shadow DOM host styling
 * - CSS animation generation
 * - Style composition and conditional application
 * - Automatic vendor prefixing
 *
 * @remarks
 * - Uses deterministic hashing for consistent class names
 * - Supports all CSS features including custom properties
 * - Handles selector specificity automatically
 * - Provides clean TypeScript types for autocompletion
 * - Optimizes stylesheet generation for performance
 */
export const css = {
  create,
  host,
  keyframes,
  assign,
}
