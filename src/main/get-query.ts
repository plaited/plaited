import type { TemplateObject } from '../jsx/jsx.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { BOOLEAN_ATTRS, P_TARGET } from '../jsx/jsx.constants.js'
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

type Bindings = {
  render(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  insert(this: Element, position: Position, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  replace(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  attr(this: Element, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
}

type BoundElement<T extends Element = Element> = T & Bindings
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

type Query = <T extends Element = Element>(
  target: string,
  /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
  match?: SelectorMatch,
) => BoundElement<T>[]
/**
 * Callback type for template cloning operations.
 * Provides query selector and data for template customization.
 *
 * @template T Type of data passed to clone operation
 * @param $ Query selector scoped to cloned content
 * @param data Data to be used in clone customization
 */
export type CloneCallback<T> = ($: Query, data: T) => void

type Clone = <T>(template: TemplateObject, callback: CloneCallback<T>) => (data: T) => DocumentFragment
/**
 * Enhanced query selector type combining element selection and template cloning.
 *
 * Features:
 * - Element querying within shadow DOM
 * - Template cloning with data binding
 * - Element enhancement with DOM manipulation methods
 *
 * @property {Query} Query function for selecting elements by p-target attribute
 * @property {Clone} clone Method for creating reusable template instances
 *
 * @example
 * // Basic querying
 * const $ = getQuery(shadowRoot);
 * const elements = $('target-name');
 *
 * // Template cloning
 * const cloneTemplate = $.clone(template, ($, data) => {
 *   $('title').render(data.title);
 *   $('content').render(data.content);
 * });
 *
 * // Using the clone
 * const instance = cloneTemplate({
 *   title: 'Hello',
 *   content: 'World'
 * });
 *
 * @remarks
 * - Queries are scoped to shadow root
 * - Cloned templates maintain style encapsulation
 * - Elements receive enhanced DOM manipulation methods
 */
export type QuerySelector = Query & {
  clone: Clone
}
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
/**
 * Processes a template object into DOM content within a shadow root.
 * Handles both HTML content and stylesheet injection.
 *
 * @param shadowRoot The shadow root to inject content into
 * @param fragment Template object containing HTML and styles
 * @returns DocumentFragment with processed HTML content
 */
export const handleTemplateObject = (shadowRoot: ShadowRoot, fragment: TemplateObject) => {
  const { html, stylesheets } = fragment
  stylesheets.length && void updateShadowRootStyles(shadowRoot, new Set(stylesheets))
  const template = document.createElement('template')
  template.setHTMLUnsafe(html.join(''))
  return template.content
}

const mapTemplates = (shadowRoot: ShadowRoot, templates: (TemplateObject | DocumentFragment | Element | string)[]) => {
  const content: (DocumentFragment | string | Element)[] = []
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const fragment = templates[i]
    if (isTypeOf<TemplateObject>(fragment, 'object')) {
      content.push(handleTemplateObject(shadowRoot, fragment))
    } else {
      content.push(fragment)
    }
  }
  return content
}

const getBindings = (shadowRoot: ShadowRoot): Bindings => ({
  render(...templates) {
    this.replaceChildren(...mapTemplates(shadowRoot, templates))
  },
  insert(position, ...templates) {
    const content = mapTemplates(shadowRoot, templates)
    position === 'beforebegin' ? this.before(...content)
    : position === 'afterbegin' ? this.prepend(...content)
    : position === 'beforeend' ? this.append(...content)
    : this.after(...content)
  },
  replace(...templates) {
    this.replaceWith(...mapTemplates(shadowRoot, templates))
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
export const assignBinding = <T extends Element = Element>(bindings: Bindings, elements: Element[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) {
    const el = elements[i]
    if (hasBinding(el)) continue
    const boundEl = Object.assign(el, bindings)
    boundElementSet.add(boundEl)
  }
  return elements as BoundElement<T>[]
}

const bindingsMap = new WeakMap<ShadowRoot, Bindings>()
/**
 * Retrieves or creates binding methods for a shadow root.
 * Caches bindings to prevent duplicate creation.
 *
 * @param shadowRoot Shadow root to get bindings for
 * @returns Binding methods for DOM manipulation
 */
export const getBoundInstance = (shadowRoot: ShadowRoot) =>
  bindingsMap.get(shadowRoot) ?? (bindingsMap.set(shadowRoot, getBindings(shadowRoot)).get(shadowRoot) as Bindings)
/**
 * Creates a query selector with enhanced capabilities for shadow DOM.
 * Includes template cloning and element binding functionality.
 *
 * Features:
 * - Targeted element selection
 * - Template cloning with data binding
 * - Element enhancement with DOM methods
 * - Style injection management
 *
 * @param shadowRoot Shadow root to query within
 * @returns Enhanced query selector function with cloning capability
 *
 * @example
 * const $ = getQuery(shadowRoot);
 *
 * // Query elements
 * const elements = $('target-name');
 *
 * // Clone template with data
 * const clone = $.clone(template, ($, data) => {
 *   $('item').render(data.content);
 * });
 */
export const getQuery = (shadowRoot: ShadowRoot): QuerySelector => {
  const instance = getBoundInstance(shadowRoot)
  const query = <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
    assignBinding<T>(instance, Array.from(shadowRoot.querySelectorAll<Element>(`[${P_TARGET}${match}"${target}"]`)))
  const queryFrag =
    (frag: DocumentFragment) =>
    <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
      assignBinding<T>(instance, Array.from(frag.querySelectorAll<Element>(`[${P_TARGET}${match}"${target}"]`)))
  const clone: Clone = (template, callback) => {
    return (data) => {
      const content = handleTemplateObject(shadowRoot, template)
      callback(queryFrag(content), data)
      return content
    }
  }
  query.clone = clone
  return query
}
