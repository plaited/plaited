import type { TemplateObject } from '../jsx/jsx.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'
/**
 * Valid insertion positions for DOM elements relative to a reference element.
 * Follows the insertAdjacentElement/HTML specification.
 *
 * @type {string}
 * Values:
 * - 'beforebegin': Before the reference element itself
 * - 'afterbegin':  Inside the reference element, before its first child
 * - 'beforeend':   Inside the reference element, after its last child
 * - 'afterend':    After the reference element itself
 *
 * @example
 * // Visual representation:
 * // <!-- beforebegin -->
 * // <div>           // reference element
 * //   <!-- afterbegin -->
 * //   content
 * //   <!-- beforeend -->
 * // </div>
 * // <!-- afterend -->
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentElement
 */
export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

export type Bindings = {
  render(this: Element, ...template: (TemplateObject | string | number)[]): void
  insert(this: Element, position: Position, ...template: (TemplateObject | string | number)[]): void
  replace(this: Element, ...template: (TemplateObject | string | number)[]): void
  attr(this: Element, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
}

export type BoundElement<T extends Element = Element> = T & Bindings
/**
 * Type for element matching strategies in attribute selectors.
 * Supports all CSS attribute selector operators.
 *
 * Values:
 * - '=':  Exact match
 * - '~=': Space-separated list contains
 * - '|=': Exact match or prefix followed by hyphen
 * - '^=': Starts with
 * - '$=': Ends with
 * - '*=': Contains
 */
export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='

export type Query = <T extends Element = Element>(
  target: string,
  /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
  match?: SelectorMatch,
) => BoundElement<T>[]

/**
 * Cache for storing stylesheets per ShadowRoot.
 * Prevents duplicate style injection and maintains stylesheet references.
 */
export const cssCache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  const instanceStyles = cssCache.get(root) ?? cssCache.set(root, new Set()).get(root)
  const newStyleSheets: CSSStyleSheet[] = []
  try {
    await Promise.all(
      [...stylesheets].map(async (styles) => {
        if (instanceStyles?.has(styles)) return
        const sheet = new CSSStyleSheet()
        instanceStyles?.add(styles)
        const nextSheet = await sheet.replace(styles)
        newStyleSheets.push(nextSheet)
      }),
    )
  } catch (error) {
    console.error(error)
  }
  if (newStyleSheets.length) root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...newStyleSheets]
}

const updateAttributes = (element: Element, attr: string, val: string | null | number | boolean) => {
  // Remove the attribute if val is null or undefined, and it currently exists
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  // Set the attribute if it is a boolean attribute and it does not exist
  if (BOOLEAN_ATTRS.has(attr)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if the new value is different from the current value
  element.setAttribute(attr, `${val}`)
}

export const getDocumentFragment = (shadowRoot: ShadowRoot, templates: (TemplateObject | string | number)[]) => {
  const content: (string | number)[] = []
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const fragment = templates[i]
    if (isTypeOf<TemplateObject>(fragment, 'object')) {
      const { html, stylesheets } = fragment
      stylesheets.length && void updateShadowRootStyles(shadowRoot, new Set(stylesheets))
      content.push(...html)
    } else {
      content.push(fragment)
    }
  }
  const template = document.createElement('template')
  template.setHTMLUnsafe(content.join(''))
  return template.content
}

export const getBindings = (shadowRoot: ShadowRoot): Bindings => ({
  render(...templates) {
    this.replaceChildren(getDocumentFragment(shadowRoot, templates))
  },
  insert(position, ...templates) {
    const content = getDocumentFragment(shadowRoot, templates)
    position === 'beforebegin' ? this.before(content)
    : position === 'afterbegin' ? this.prepend(content)
    : position === 'beforeend' ? this.append(content)
    : this.after(content)
  },
  replace(...templates) {
    this.replaceWith(getDocumentFragment(shadowRoot, templates))
  },
  attr(attr, val) {
    if (isTypeOf<string>(attr, 'string')) {
      // Return the attribute value if val is not provided
      if (val === undefined) return this.getAttribute(attr)
      return updateAttributes(this, attr, val)
    }
    for (const key in attr) {
      updateAttributes(this, key, attr[key])
    }
  },
})

const boundElementSet = new WeakSet<Element>()
const hasBinding = (element: Element): element is BoundElement => boundElementSet.has(element)
/**
 * Assigns DOM manipulation methods to elements.
 * Adds render, insert, replace, and attribute manipulation capabilities.
 *
 * @param bindings Methods to be bound to elements
 * @param elements Array of elements to enhance
 * @returns Array of enhanced elements with bound methods
 */
export const assignHelpers = <T extends Element = Element>(bindings: Bindings, elements: Element[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) {
    const el = elements[i]
    if (hasBinding(el)) continue
    const boundEl = Object.assign(el, bindings)
    boundElementSet.add(boundEl)
  }
  return elements as BoundElement<T>[]
}
