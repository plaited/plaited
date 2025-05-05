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

/** @internal Helper function to create a deterministic hash for class names based on style properties and selectors. */
const createClassHash = (...args: (string | number)[]) =>
  hashString(args.join(' '))?.toString(36).replace(/^-/g, '_') ?? ''

/** @internal Type guard to check if a value is a string or number. */
const isPrimitive = (val: string | number | CreateNestedCSS<string>): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/** @internal Converts camelCase to kebab-case unless it's a CSS variable (--*). */
const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

/** @internal Recursively processes style objects, generates class names and rules, and populates the provided map. */
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

/**
 * @description Creates Plaited style objects containing hashed class names and corresponding CSS rules.
 * It processes nested selectors (like pseudo-classes, media queries) and generates unique, scoped class names.
 *
 * @template T - An object type where keys are logical style group names and values are `CSSClasses` objects.
 * @param {T} classNames - An object defining style groups and their CSS properties.
 * @returns {StyleObjects<T>} An object mirroring the input structure, where each value is a `StylesObject`
 * containing the generated `className` (string of space-separated classes) and `stylesheet` (array of CSS rules).
 *
 * @example
 * ```typescript
 * const styles = css.create({
 *   button: {
 *     color: 'blue',
 *     backgroundColor: 'white',
 *     '&:hover': { // Nested pseudo-class
 *       color: 'darkblue',
 *     },
 *     '@media (min-width: 768px)': { // Nested media query
 *       padding: '10px 20px',
 *     }
 *   },
 *   textInput: {
 *     border: '1px solid gray',
 *     '&:focus': {
 *       borderColor: 'blue',
 *     }
 *   }
 * });
 *
 * // Usage in a template:
 * const MyButton = () => <button {...styles.button}>Click Me</button>;
 *
 * // styles.button.className might be "button_abc p123 p456 p789"
 * // styles.button.stylesheet would contain the corresponding CSS rules.
 * ```
 */
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

/**
 * @description Generates a `StylesObject` specifically for styling the `:host` of a shadow DOM component.
 * Supports nested selectors within the host context (e.g., `:host(.active)`).
 *
 * @param {CSSHostProperties} props - An object containing CSS properties to apply to the host.
 *        Values can be primitives or objects where keys are selectors relative to `:host` (e.g., `.theme-dark`, `[disabled]`)
 *        and `default` represents the base `:host` style.
 * @returns {StylesObject} A `StylesObject` containing only the `stylesheet` array with `:host` rules.
 *
 * @example
 * ```typescript
 * const hostStyles = css.host({
 *   display: 'block', // Applies to :host
 *   padding: {
 *     default: '16px', // Applies to :host
 *     '.compact': '8px', // Applies to :host(.compact)
 *     '[state|loading]': '32px' // Applies to :host([state|loading])
 *   },
 *   color: 'black',
 * });
 *
 * // Usage in defineElement:
 * defineElement({
 *   tag: 'my-styled-host',
 *   shadowDom: <div {...hostStyles}>Content</div>, // Stylesheet applied to shadow root
 *   // ...
 * });
 * ```
 */
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

/**
 * @description Creates a CSS `@keyframes` animation definition with a uniquely hashed name.
 * Returns a function that, when called, provides the `StylesObject` containing the `@keyframes` rule.
 * The returned function also has an `id` property holding the generated animation name.
 *
 * @param {string} name - A base name for the animation (will be hashed for uniqueness).
 * @param {CSSKeyFrames} frames - An object defining the keyframes (e.g., `from`, `to`, `0%`, `100%`) and their corresponding `CSSProperties`.
 * @returns {() => StylesObject & { id: string }} A function that returns the `StylesObject` for the keyframes rule, with an added `id` property containing the unique animation name.
 *
 * @example
 * ```typescript
 * const fadeIn = css.keyframes('fadeIn', {
 *   from: { opacity: 0 },
 *   to: { opacity: 1 }
 * });
 *
 * const styles = css.create({
 *   animatedBox: {
 *     animationName: fadeIn.id, // Use the generated unique name
 *     animationDuration: '1s',
 *   }
 * });
 *
 * // Usage in a template:
 * const AnimatedComponent = () => (
 *   <div {...css.assign(styles.animatedBox, fadeIn())}> // Assign box styles and keyframes rule
 *     Fade In
 *   </div>
 * );
 * ```
 */
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

/**
 * @description Merges multiple `StylesObject` instances (or falsy values) into a single `StylesObject`.
 * It concatenates the `className` strings and `stylesheet` arrays from all provided valid objects.
 * Falsy values (`undefined`, `false`, `null`) are ignored, allowing for conditional style application.
 *
 * @param {...(StylesObject | undefined | false | null)} styleObjects - A variable number of `StylesObject` instances or falsy values to combine.
 * @returns {StylesObject} A new `StylesObject` with combined `className` and `stylesheet` properties.
 *         Returns `{ className: undefined, stylesheet: undefined }` if no valid style objects are provided.
 *
 * @example
 * ```typescript
 * const baseStyles = css.create({ base: { padding: '10px' } });
 * const activeStyles = css.create({ active: { fontWeight: 'bold' } });
 * const errorStyles = css.create({ error: { color: 'red' } });
 *
 * const isActive = true;
 * const hasError = false;
 *
 * // Combine styles conditionally
 * const combined = css.assign(
 *   baseStyles.base,
 *   isActive && activeStyles.active,
 *   hasError && errorStyles.error
 * );
 *
 * // Usage in a template:
 * const DynamicComponent = () => <div {...combined}>Content</div>;
 * // If isActive is true and hasError is false, combined.className might be "base_xyz p111 active_uvw p222"
 * ```
 */
const assign = (...styleObjects: Array<StylesObject | undefined | false | null>) => {
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { className, stylesheet } = styleObject
    className && cls.push(...(Array.isArray(className) ? (className.filter(Boolean) as string[]) : [className]))
    stylesheet && style.push(...(Array.isArray(stylesheet) ? (stylesheet.filter(Boolean) as string[]) : [stylesheet]))
  }
  return { className: cls.length ? cls : undefined, stylesheet: style.length ? style : undefined }
}

/**
 * @namespace css
 * @description A comprehensive CSS-in-JS utility tailored for Plaited.
 * It provides type-safe functions for creating, managing, and composing styles
 * with automatic class name hashing, style deduplication, and support for modern CSS features.
 *
 * @property {function} create - Generates `StylesObject`s from CSS class definitions, handling nesting and hashing.
 * @property {function} host - Creates `:host` styles for shadow DOM components.
 * @property {function} keyframes - Defines CSS `@keyframes` animations with unique names.
 * @property {function} assign - Merges multiple `StylesObject`s, useful for conditional styling.
 *
 * @example Full Example
 * ```typescript
 * import { css, defineElement, h } from 'plaited';
 *
 * const slideIn = css.keyframes('slideIn', {
 *   from: { transform: 'translateX(-100%)' },
 *   to: { transform: 'translateX(0)' }
 * });
 *
 * const styles = css.create({
 *   container: {
 *     padding: '16px',
 *     border: '1px solid #ccc',
 *     '@media (min-width: 768px)': {
 *       padding: '24px',
 *     }
 *   },
 *   title: {
 *     fontSize: '24px',
 *     fontWeight: 'bold',
 *     animationName: slideIn.id, // Use keyframe ID
 *     animationDuration: '0.5s',
 *   }
 * });
 *
 * const hostStyles = css.host({
 *   display: 'block',
 *   ':host([hidden])': { // Style host when hidden attribute is present
 *     display: 'none',
 *   }
 * });
 *
 * const MyComponent = defineElement({
 *   tag: 'my-component',
 *   shadowDom: (
 *     <div {...css.assign(hostStyles, styles.container, slideIn())}> // Assign host, container, and keyframes
 *       <h1 {...styles.title}>Hello Plaited!</h1>
 *     </div>
 *   )
 * });
 *
 * // Use the component
 * const App = () => <MyComponent />;
 * ```
 *
 * @remarks
 * - Designed for use with Plaited's `defineElement` and JSX factory (`h`).
 * - Ensures styles are scoped and avoids global namespace collisions through hashing.
 * - Provides strong TypeScript support for CSS properties and values.
 * - Stylesheets are automatically collected and managed by Plaited's rendering system (SSR and client-side).
 */
export const css = {
  create,
  host,
  keyframes,
  assign,
}
