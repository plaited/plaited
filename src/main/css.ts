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

/**
 * @internal
 * Helper function to create a deterministic hash for class names based on style properties and selectors.
 *
 * @param args - The strings and numbers to hash together
 * @returns A base36 hash string prefixed with underscore if negative
 */
const createClassHash = (...args: (string | number)[]) =>
  hashString(args.join(' '))?.toString(36).replace(/^-/g, '_') ?? ''

/**
 * @internal
 * Type guard to check if a value is a primitive CSS value (string or number).
 *
 * @param val - The value to test
 * @returns True if the value is a string or number
 */
const isPrimitive = (val: string | number | CreateNestedCSS<string>): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/**
 * @internal
 * Converts a CSS property name to kebab-case unless it's already a CSS variable (--*).
 *
 * @param prop - The property name to convert
 * @returns The kebab-cased property or unchanged CSS variable
 */
const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

/**
 * @internal
 * Recursively processes nested CSS rules (like media queries, pseudo-classes)
 * defined in a `CreateNestedCSS` object, generating hashed class names and CSS rules,
 * and populating the provided map.
 *
 * @param map - A Map to store generated class names and their corresponding CSS rules
 * @param value - The CSS property value, which can be a primitive or a nested object
 * @param prop - The CSS property name (e.g., 'color', 'backgroundColor')
 * @param selectors - An array accumulating nested selectors (e.g., [':hover', '@media (...)'])
 */
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

const create = <T extends CSSClasses>(classNames: T) =>
  Object.entries(classNames).reduce((acc, [cls, props]) => {
    const map = new Map<string, string>()
    for (const prop in props) formatStyles({ map, prop, value: props[prop] })
    const classes = [...map.keys()]
    const hash = createClassHash(...classes)
    acc[cls as keyof T] = {
      class: [`${cls}_${hash}`, ...classes].join(' '),
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
  const cls: string[] = []
  const style: string[] = []
  for (const styleObject of styleObjects) {
    if (!styleObject) continue
    const { class: className, stylesheet } = styleObject
    className && cls.push(...(Array.isArray(className) ? (className.filter(Boolean) as string[]) : [className]))
    stylesheet && style.push(...(Array.isArray(stylesheet) ? (stylesheet.filter(Boolean) as string[]) : [stylesheet]))
  }
  return { class: cls.length ? cls : undefined, stylesheet: style.length ? style : undefined }
}

/**
 * @namespace css
 * @description A powerful CSS-in-JS system providing type-safe, scoped styling capabilities for Plaited applications.
 * Built specifically for modern component architecture with focus on developer experience and runtime performance.
 *
 * ## Key Features
 *
 * - **Atomic CSS Generation**: Creates optimized, deduplicated style rules
 * - **Type Safety**: Complete TypeScript integration with property autocompletion
 * - **Nested Selectors**: Support for pseudo-classes, attributes, and media queries
 * - **Shadow DOM Integration**: First-class support for web components and custom elements
 * - **Zero Runtime Dependencies**: Minimal size impact with maximum performance
 * - **Design Token Compatibility**: Seamless integration with design system tokens
 *
 * The system automatically generates unique, collision-free class names and optimizes
 * style output to minimize CSS duplication and specificity issues.
 *
 * @property {function} create - Generates style objects with hashed class names from style definitions
 * @property {function} host - Creates shadow DOM host styles with attribute and state-based conditions
 * @property {function} keyframes - Defines reusable CSS animations with unique identifiers
 * @property {function} assign - Combines and conditionally applies multiple style objects
 * @remarks
 * - Designed to work with both Plaited components and standard HTML elements
 * - Stylesheets are automatically collected and managed by the rendering system
 * - Efficiently handles style reapplication without unnecessary DOM operations
 * - Compatible with server-side rendering and static site generation
 * - Uses deterministic hashing for predictable class name generation
 */
export const css = {
  /**
   * Creates Plaited style objects (`StyleObjects`) from a configuration object (`CSSClasses`).
   * It processes CSS properties, including nested structures for pseudo-classes, attribute selectors,
   * media queries, etc., generating unique, hashed class names and corresponding CSS rules.
   *
   * @template T - An object type extending `CSSClasses`, where keys are logical style group names (e.g., 'button', 'input')
   *               and values define the CSS properties for that group.
   * @param {T} classNames - The configuration object defining style groups and their CSS properties.
   *                         Property keys are camelCased CSS properties (e.g., `backgroundColor`) or CSS variables (`--my-var`).
   *                         Values can be primitives (string/number) or nested objects (`CreateNestedCSS`) for conditional styles.
   * @returns {StyleObjects<T>} An object mirroring the input structure (`T`). Each key holds a `StylesObject` containing:
   *                            - `class`: A string of space-separated, generated class names (e.g., "button_abc p123 p456").
   *                                           Includes a base class (`button_abc`) and atomic classes (`p123`, `p456`).
   *                            - `stylesheet`: An array of CSS rule strings corresponding to the generated classes.
   *
   * @example Simple Usage
   * ```typescript
   * const styles = css.create({
   *   primaryButton: {
   *     backgroundColor: 'blue',
   *     color: 'white',
   *     padding: '10px 15px',
   *   }
   * });
   * // styles.primaryButton.class -> "primaryButton_xyz p111 p222 p333"
   * // styles.primaryButton.stylesheet -> [".p111{background-color:blue;}", ".p222{color:white;}", ...]
   * ```
   *
   * @example Nested Selectors
   * ```typescript
   * const styles = css.create({
   *   card: {
   *     border: '1px solid lightgray',
   *     borderRadius: '4px',
   *     ':hover': { // Pseudo-class
   *       borderColor: 'gray',
   *       boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
   *     },
   *     '@media (min-width: 768px)': { // Media query
   *       padding: '20px',
   *     },
   *     '[data-state="selected"]': { // Attribute selector
   *       backgroundColor: 'lightblue',
   *     }
   *   }
   * });
   * // Generates classes and rules for base, :hover, @media, and [data-state="selected"] states.
   * ```
   *
   * @example Nested Property Values
   * ```typescript
   * const styles = css.create({
   *   dynamicText: {
   *     fontSize: {
   *       default: '16px', // Base font size
   *       '@media (min-width: 1024px)': '18px', // Larger on desktop
   *       ':first-letter': { // Nested pseudo-element within property
   *          default: '24px',
   *          '@media (min-width: 1024px)': '28px',
   *       }
   *     }
   *   }
   * });
   * // Generates classes/rules for default, @media, :first-letter, and @media + :first-letter combinations.
   * ```
   */
  create,
  /**
   * Generates a `StylesObject` containing CSS rules specifically targeting the `:host`
   * of a shadow DOM component. Allows defining base host styles and styles conditional
   * on host selectors (e.g., attributes, classes).
   *
   * @param {CSSHostProperties} props - An object where keys are camelCased CSS properties or CSS variables.
   *        Values can be:
   *        - Primitives (string/number): Applied directly to `:host`.
   *        - Objects: Where keys are selectors relative to `:host` (e.g., `'.active'`, `'[disabled]'`, `':host-context(.theme-dark)'`)
   *          and values are the corresponding CSS property values for that condition. The key `'default'` applies to the base `:host`.
   * @returns {StylesObject} A `StylesObject` containing only the `stylesheet` array with the generated `:host` rules.
   *                         The `class` property will be undefined.
   *
   * @example
   * ```typescript
   * const hostStyles = css.host({
   *   display: 'inline-block', // Base style: :host { display: inline-block; }
   *   border: {
   *     default: '1px solid transparent', // Base style: :host { border: 1px solid transparent; }
   *     ':hover': '1px solid blue',      // Conditional: :host(:hover) { border: 1px solid blue; }
   *     '[focused]': '1px solid darkblue', // Conditional: :host([focused]) { border: 1px solid darkblue; }
   *   },
   *   '--internal-padding': '8px', // CSS Variable: :host { --internal-padding: 8px; }
   * });
   *
   * // Usage within defineElement:
   * defineElement({
   *   tag: 'my-interactive-element',
   *   shadowDom: <div {...hostStyles}>...</div> // Stylesheet is applied to the shadow root
   * });
   * ```
   */
  host,
  /**
   * Creates a CSS `@keyframes` animation definition with a uniquely hashed name.
   * Returns a function that, when called, provides the `StylesObject` containing the
   * generated `@keyframes` rule. This function also has an `id` property holding the
   * unique animation name, intended for use in `animation-name` properties.
   *
   * @param {string} name - A descriptive base name for the animation (e.g., 'fadeIn', 'slideUp'). This name is hashed for uniqueness.
   * @param {CSSKeyFrames} frames - An object defining the keyframes. Keys are percentages (`'0%'`, `'100%'`) or keywords (`'from'`, `'to'`).
   *                                Values are objects containing camelCased CSS properties for that keyframe.
   * @returns {(() => StylesObject) & { id: string }} A function that returns the `StylesObject` for the keyframes rule.
   *                                                  This function has an added `id` property containing the unique animation name (e.g., "fadeIn_a1b2c3").
   *
   * @example
   * ```typescript
   * // 1. Define the keyframes
   * const bounce = css.keyframes('bounce', {
   *   '0%, 100%': { transform: 'translateY(0)', animationTimingFunction: 'ease-out' },
   *   '50%': { transform: 'translateY(-10px)', animationTimingFunction: 'ease-in' }
   * });
   *
   * // bounce.id -> "bounce_xyz" (unique hashed name)
   *
   * // 2. Create styles using the keyframe ID
   * const styles = css.create({
   *   bouncingBall: {
   *     width: '50px',
   *     height: '50px',
   *     borderRadius: '50%',
   *     backgroundColor: 'red',
   *     animationName: bounce.id, // Use the generated ID
   *     animationDuration: '1s',
   *     animationIterationCount: 'infinite',
   *   }
   * });
   *
   * // 3. Assign styles and the keyframes rule in the template
   * const Ball = () => <div {...css.assign(styles.bouncingBall, bounce())}></div>;
   * // Calling bounce() returns { stylesheet: ["@keyframes bounce_xyz { ... }"] }
   * // css.assign merges the ball styles and the keyframes definition.
   * ```
   */
  keyframes,
  /**
   * Merges multiple `StylesObject` instances (or falsy values like `undefined`, `false`, `null`)
   * into a single `StylesObject`. It concatenates `class` strings and `stylesheet` arrays
   * from all valid input objects. Falsy values are ignored, enabling easy conditional style composition.
   *
   * @param {...(StylesObject | undefined | false | null)} styleObjects - A variable number of `StylesObject` instances or falsy values.
   * @returns {StylesObject} A new `StylesObject` with combined `class` and `stylesheet` properties.
   *                         If no valid `StylesObject`s are provided, returns `{ class: undefined, stylesheet: undefined }`.
   *
   * @example Conditional Styling
   * ```typescript
   * const base = css.create({ base: { color: 'black' } });
   * const active = css.create({ active: { fontWeight: 'bold' } });
   * const disabled = css.create({ disabled: { opacity: 0.5, pointerEvents: 'none' } });
   *
   * const isActive = true;
   * const isDisabled = false;
   *
   * const buttonStyles = css.assign(
   *   base.base,
   *   isActive && active.active, // Included if isActive is true
   *   isDisabled && disabled.disabled // Ignored if isDisabled is false
   * );
   *
   * // buttonStyles.class -> "base_abc p111 active_def p222" (if isActive)
   * // buttonStyles.stylesheet -> [".p111{color:black;}", ".p222{font-weight:bold;}"]
   *
   * const MyButton = () => <button {...buttonStyles}>Click</button>;
   * ```
   *
   * @example Combining with Host and Keyframes
   * ```typescript
   * const hostStyles = css.host({ display: 'block' });
   * const anim = css.keyframes('fade', { from: { opacity: 0 }, to: { opacity: 1 } });
   * const elementStyles = css.create({ el: { animationName: anim.id, animationDuration: '1s' } });
   *
   * const combined = css.assign(hostStyles, elementStyles.el, anim());
   * // combined.stylesheet will contain host rules, element rules, and the keyframes rule.
   * ```
   */
  assign,
}
