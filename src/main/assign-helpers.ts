import type { TemplateObject } from '../jsx/jsx.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'

import type { Bindings, BoundElement } from './plaited.types.js'
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

export const getDocumentFragment = (shadowRoot: ShadowRoot, templateObject: TemplateObject) => {
  const { html, stylesheets } = templateObject
  stylesheets.length && void updateShadowRootStyles(shadowRoot, new Set(stylesheets))
  const template = document.createElement('template')
  template.setHTMLUnsafe(html.join(''))
  return template.content
}

const formatFragments = (shadowRoot: ShadowRoot, fragments: (number | string | TemplateObject | DocumentFragment)[]) =>
  fragments.map((frag) =>
    isTypeOf<TemplateObject>(frag, 'object') ? getDocumentFragment(shadowRoot, frag)
    : isTypeOf<number>(frag, 'number') ? `${frag}`
    : frag,
  )

export const getBindings = (shadowRoot: ShadowRoot): Bindings => ({
  render(...fragments) {
    this.replaceChildren(...formatFragments(shadowRoot, fragments))
  },
  insert(position, ...fragments) {
    const content = formatFragments(shadowRoot, fragments)
    position === 'beforebegin' ? this.before(...content)
    : position === 'afterbegin' ? this.prepend(...content)
    : position === 'beforeend' ? this.append(...content)
    : this.after(...content)
  },
  replace(...fragments) {
    this.replaceWith(...formatFragments(shadowRoot, fragments))
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
