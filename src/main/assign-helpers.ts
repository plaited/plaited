import type { TemplateObject } from '../jsx/jsx.types.js'
import { BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'
import type { Bindings, BoundElement } from './plaited.types.js'

/**
 * @description WeakMap used to cache adopted stylesheets per ShadowRoot.
 * This prevents redundant parsing and adoption of the same CSSStyleSheet
 * instance within a single component instance, optimizing performance when
 * styles are dynamically added or components are re-rendered.
 * The key is the `ShadowRoot` instance, and the value is a `Set` of stylesheet strings
 * that have already been processed and adopted for that root.
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

/**
 * @description Creates a `DocumentFragment` from a Plaited `TemplateObject`.
 * It processes the template's HTML string and ensures its associated stylesheets
 * are adopted by the provided `shadowRoot` (using the `cssCache` for deduplication).
 *
 * @param {ShadowRoot} shadowRoot - The shadow root instance where the styles should be adopted.
 * @param {TemplateObject} templateObject - The Plaited template object containing `html` and `stylesheets`.
 * @returns {DocumentFragment} A document fragment containing the parsed HTML content from the template object.
 *
 * @example
 * ```typescript
 * // Assuming `myTemplate` is a TemplateObject, `this.#root` is a ShadowRoot, and el is an element
 * const fragment = getDocumentFragment(this.#root, myTemplate);
 * el.appendChild(fragment); // Append the content to the element
 * ```
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
 * @description Creates a `Bindings` object containing helper methods for DOM manipulation,
 * bound to a specific `shadowRoot` context. These methods handle stylesheet adoption
 * when inserting content derived from `TemplateObject` instances.
 *
 * The returned object's methods (`render`, `insert`, `replace`, `attr`) are intended to be
 * assigned to elements queried within the Plaited component (see `assignHelpers`).
 *
 * @param {ShadowRoot} shadowRoot - The shadow root context for stylesheet adoption and fragment processing.
 * @returns {Bindings} An object containing the DOM helper methods:
 *   - `render`: Replaces the element's content.
 *   - `insert`: Inserts content relative to the element ('beforebegin', 'afterbegin', 'beforeend', 'afterend').
 *   - `replace`: Replaces the element itself with new content.
 *   - `attr`: Gets or sets attributes on the element.
 *
 * @remarks
 * The `this` context within these methods refers to the element they are bound to.
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
      return updateAttributes(this, attr, val)
    }
    for (const key in attr) {
      updateAttributes(this, key, attr[key])
    }
  },
})

/**
 * @description Assigns the Plaited DOM helper methods (from a `Bindings` object) to a list of elements.
 * This enhances standard DOM elements with methods like `render`, `insert`, `replace`, and `attr`,
 * making DOM manipulation within Plaited components more convenient and integrated with stylesheet management.
 * It only assigns the methods if they don't already exist on the element.
 *
 * @template T - The type of the elements in the list, defaulting to `Element`.
 * @param {Bindings} bindings - The object containing the helper methods (typically created by `getBindings`).
 * @param {NodeListOf<T> | T[]} elements - A `NodeListOf` or array of elements to enhance.
 * @returns {BoundElement<T>[]} The same array of elements, now typed as `BoundElement<T>` to reflect the added methods.
 *
 * @example
 * ```typescript
 * // Inside a Plaited component's setup (e.g., connectedCallback or bProgram)
 * const bindings = getBindings(this.#root);
 * const targetElements = this.#root.querySelectorAll('[p-target]');
 * const boundElements = assignHelpers(bindings, targetElements);
 *
 * // Now you can use the helper methods directly on the elements:
 * if (boundElements.length > 0) {
 *   boundElements[0].render('New content');
 *   boundElements[0].attr('data-state', 'updated');
 * }
 * ```
 */
export const assignHelpers = <T extends Element = Element>(bindings: Bindings, elements: NodeListOf<T> | T[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) !('attr' in elements[i]) && Object.assign(elements[i], bindings)
  return elements as BoundElement<T>[]
}
