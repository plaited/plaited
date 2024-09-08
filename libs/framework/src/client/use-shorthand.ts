import type { TemplateObject } from '../jsx/types.js'
import type { BPEvent } from '../behavioral/b-thread.js'
import { isTypeOf } from '../utils/true-type-of.js'
import { BOOLEAN_ATTRS, P_TARGET } from '../jsx/constants.js'

type Bindings = {
  render(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  insert(this: Element, position: Position, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  replace(this: Element, ...template: (TemplateObject | DocumentFragment | Element | string)[]): void
  attr(this: Element, attr: Record<string, string | null | number | boolean>, val?: never): void
  attr(this: Element, attr: string, val?: string | null | number | boolean): string | null | void
}

type BoundElement<T extends Element = Element> = T & Bindings

export type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'

export type SelectorMatch = '=' | '~=' | '|=' | '^=' | '$=' | '*='


type Dispatch = <T = unknown>(
  args: BPEvent<T> & {
    bubbles?: boolean
    cancelable?: boolean
    composed?: boolean
  },
) => void

type Query = <T extends Element = Element>(
  target: string,
  /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
  match?: SelectorMatch,
) => BoundElement<T>[]

type Clone = <T>(
  template: TemplateObject,
  callback: ($:Query, data: T ) => void,
) => (data: T) => DocumentFragment

export type Shorthand = Query & {
  dispatch: Dispatch
  clone: Clone
}

export const cssCache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  const instanceStyles = cssCache.get(root)
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
export const getBoundInstance = (shadowRoot: ShadowRoot) =>
  bindingsMap.get(shadowRoot) ?? (bindingsMap.set(shadowRoot, getBindings(shadowRoot)).get(shadowRoot) as Bindings)

export const useShorthand = (shadowRoot: ShadowRoot): Shorthand => {
  const instance = getBoundInstance(shadowRoot)
  const select = <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
    assignBinding<T>(instance, Array.from(shadowRoot.querySelectorAll<Element>(`[${P_TARGET}${match}"${target}"]`)))
  const selectFrag =
    (frag: DocumentFragment) =>
    <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
      assignBinding<T>(instance, Array.from(frag.querySelectorAll<Element>(`[${P_TARGET}${match}"${target}"]`)))
  const dispatch:Dispatch =  ({ type, detail, bubbles = false, cancelable = true, composed = true }) => {
    if (!type) return
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })
    shadowRoot.host.dispatchEvent(event)
  }
  const clone:Clone = (template, callback) => {
    return (data) => {
      const content = handleTemplateObject(shadowRoot, template)
      callback(selectFrag(content), data)
      return content
    }
  }
  select.dispatch = dispatch
  select.clone = clone
  return select
}
