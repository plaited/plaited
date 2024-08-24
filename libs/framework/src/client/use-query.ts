
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */
import type { Bindings, BoundElement, QuerySelector, SelectorMatch } from './types.js'
import type { TemplateObject, BooleanAttributes } from '../jsx/types.js'
import { isTypeOf } from '@plaited/utils'
import { BOOLEAN_ATTRS, P_TARGET } from '../jsx/constants.js'

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
  if (BOOLEAN_ATTRS.has(attr as BooleanAttributes)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if the new value is different from the current value
  element.setAttribute(attr, `${val}`)
}

export const handleTemplateObject = (shadowRoot: ShadowRoot, fragment: TemplateObject) => {
  const { html, stylesheets } = fragment
  stylesheets.size && void updateShadowRootStyles(shadowRoot, stylesheets)
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


export const useQuery = (shadowRoot: ShadowRoot): QuerySelector => {
  const instance = getBoundInstance(shadowRoot)
  return <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
    assignBinding<T>(instance, Array.from(shadowRoot.querySelectorAll<Element>(`[${P_TARGET}${match}"${target}"]`)))
}
