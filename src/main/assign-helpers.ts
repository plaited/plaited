import type { TemplateObject } from '../jsx/jsx.types.js'
import { BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'
import type { Bindings, BoundElement } from './plaited.types.js'
import type { StylesObject } from './css.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
/**
 * @internal Cache for storing adopted stylesheets per ShadowRoot to prevent duplicate processing.
 * Used internally by the framework to optimize style adoption performance.
 */
export const cssCache = new WeakMap<ShadowRoot, Set<string>>()

/** @internal Asynchronously updates the adopted stylesheets for a given ShadowRoot. */
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

/** @internal Safely updates or removes an attribute on an element, handling boolean attributes correctly. */
const updateAttributes = ({
  element,
  attr,
  val,
  root,
}: {
  element: Element
  attr: string | 'class'
  val: string | null | number | boolean | StylesObject
  root: ShadowRoot
}) => {
  // Remove the attribute if val is null or undefined, and it currently exists
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  // Set the attribute if it is a boolean attribute and it does not exist
  if (BOOLEAN_ATTRS.has(attr)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if the new value is different from the current value
  if (attr === 'class' && isTypeOf<StylesObject>(val, 'object')) {
    void updateShadowRootStyles(root, new Set(val.stylesheet))
    element.setAttribute(attr, `${val.class}`)
  } else if (attr === 'part') {
    // TODO
  } else {
    element.setAttribute(attr, `${val}`)
  }
}

/**
 * @internal Creates a DocumentFragment from a Plaited template object, handling both content and styles.
 * Used internally when rendering templates within components.
 */
export const getDocumentFragment = (shadowRoot: ShadowRoot, templateObject: TemplateObject) => {
  const { html, stylesheets } = templateObject
  stylesheets.length && void updateShadowRootStyles(shadowRoot, new Set(stylesheets))
  const template = document.createElement('template')
  template.setHTMLUnsafe(html.join(''))
  return template.content
}

/** @internal Formats an array of fragments (strings, numbers, TemplateObjects, DocumentFragments) into an array of strings or DocumentFragments, ready for DOM insertion. */
const formatFragments = (
  shadowRoot: ShadowRoot,
  fragments: (number | string | TemplateObject | DocumentFragment)[],
) => {
  const length = fragments.length
  const toRet: (string | DocumentFragment)[] = []
  for (let i = 0; i < length; i++) {
    const frag = fragments[i]
    toRet.push(
      frag instanceof DocumentFragment || typeof frag === 'string' ? frag
      : typeof frag === 'number' ? `${frag}`
      : getDocumentFragment(shadowRoot, frag),
    )
  }
  return toRet
}

/**
 * @internal Creates DOM manipulation helper methods bound to a specific shadow root.
 * These methods are automatically attached to elements with p-target attributes.
 */
export const getBindings = (shadowRoot: ShadowRoot): Bindings => ({
  /** Replaces the children of the bound element with the provided fragments. */
  render(...fragments) {
    this.replaceChildren(...formatFragments(shadowRoot, fragments))
  },
  /** Inserts fragments at the specified position relative to the bound element. */
  insert(position, ...fragments) {
    const content = formatFragments(shadowRoot, fragments)
    position === 'beforebegin' ? this.before(...content)
    : position === 'afterbegin' ? this.prepend(...content)
    : position === 'beforeend' ? this.append(...content)
    : this.after(...content)
  },
  /** Replaces the bound element itself with the provided fragments. */
  replace(...fragments) {
    this.replaceWith(...formatFragments(shadowRoot, fragments))
  },
  /** Gets or sets attributes on the bound element. Can accept a single attribute name (to get) or name/value pair (to set), or an object of attributes to set. */
  attr(attr, val) {
    if (typeof attr === 'string') {
      // Return the attribute value if val is not provided
      if (val === undefined) return this.getAttribute(attr)
      return updateAttributes({
        root: shadowRoot,
        element: this,
        attr,
        val,
      })
    }
    for (const key in attr) {
      updateAttributes({
        root: shadowRoot,
        element: this,
        attr: key,
        val: attr[key],
      })
    }
  },
})

/**
 * @internal Assigns Plaited helper methods to DOM elements.
 * Used internally to enhance elements with p-target attributes.
 */
export const assignHelpers = <T extends Element = Element>(bindings: Bindings, elements: NodeListOf<T> | T[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) !Object.hasOwn(elements[i], 'attr') && Object.assign(elements[i], bindings)
  return elements as BoundElement<T>[]
}
