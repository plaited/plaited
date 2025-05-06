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

/** @internal Type guard to check if a value is a primitive CSS value (string or number). */
const isPrimitive = (val: string | number | CreateNestedCSS<string>): val is string | number =>
  typeof val === 'string' || typeof val === 'number'

/** @internal Converts a CSS property name to kebab-case unless it's already a CSS variable (--*). */
const caseProp = (prop: string) => (prop.startsWith('--') ? prop : kebabCase(prop))

/**
 * @internal Recursively processes nested CSS rules (like media queries, pseudo-classes)
 * defined in a `CreateNestedCSS` object, generating hashed class names and CSS rules,
 * and populating the provided map.
 * @param map - A Map to store generated class names and their corresponding CSS rules.
 * @param value - The CSS property value, which can be a primitive or a nested object.
 * @param prop - The CSS property name (e.g., 'color', 'backgroundColor').
 * @param selectors - An array accumulating nested selectors (e.g., [':hover', '@media (...)']).
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
 *                            - `className`: A string of space-separated, generated class names (e.g., "button_abc p123 p456").
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
 * // styles.primaryButton.className -> "primaryButton_xyz p111 p222 p333"
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
 *                         The `className` property will be undefined.
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
 * Merges multiple `StylesObject` instances (or falsy values like `undefined`, `false`, `null`)
 * into a single `StylesObject`. It concatenates `className` strings and `stylesheet` arrays
 * from all valid input objects. Falsy values are ignored, enabling easy conditional style composition.
 *
 * @param {...(StylesObject | undefined | false | null)} styleObjects - A variable number of `StylesObject` instances or falsy values.
 * @returns {StylesObject} A new `StylesObject` with combined `className` and `stylesheet` properties.
 *                         If no valid `StylesObject`s are provided, returns `{ className: undefined, stylesheet: undefined }`.
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
 * // buttonStyles.className -> "base_abc p111 active_def p222" (if isActive)
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
 * @description A utility namespace providing functions for creating and managing
 * type-safe, scoped CSS styles within Plaited applications. It leverages
 * CSS-in-JS patterns with automatic class name hashing and supports modern CSS features like nesting.
 *
 * @property {function} create - Creates style objects with hashed class names and CSS rules from a configuration object. Handles nested selectors and properties.
 * @property {function} host - Generates styles specifically for the `:host` of a shadow DOM component.
 * @property {function} keyframes - Defines CSS `@keyframes` animations with unique, hashed names.
 * @property {function} assign - Merges multiple style objects, facilitating conditional styling and composition.
 *
 * @see {@link create} For generating component-specific styles.
 * @see {@link host} For styling the component's host element.
 * @see {@link keyframes} For defining animations.
 * @see {@link assign} For combining style objects.
 *
 * @remarks
 * - Integrates seamlessly with Plaited's `defineElement` and JSX (`h` function).
 * - Generated stylesheets are automatically collected and managed by Plaited.
 * - Promotes style encapsulation and avoids global CSS conflicts.
 */
export const css = {
  create,
  host,
  keyframes,
  assign,
}
