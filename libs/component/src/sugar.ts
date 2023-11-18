import type { PlaitedComponentConstructor, SugaredElement, Sugar, SelectorMatch } from './types.js'
import type { TemplateObject } from '@plaited/jsx'
import { booleanAttrs, dataTarget } from '@plaited/jsx/utils'
import { isTypeOf } from '@plaited/utils'

/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

const cssCache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  // P1 first time dynamically setting stylesheets on instance add it to cssCache
  if (!cssCache.has(root)) {
    cssCache.set(root, new Set<string>([...(root.host.constructor as PlaitedComponentConstructor).stylesheets]))
  }
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

const updateAttributes = (element: HTMLElement | SVGElement, attr: string, val: string | null | number | boolean) => {
  if (val === null && element.hasAttribute(attr)) {
    // Remove the attribute if val is null or undefined, and it currently exists
    element.removeAttribute(attr)
  } else if (booleanAttrs.has(attr) && !element.hasAttribute(attr)) {
    // Set the attribute if it is a boolean attribute and it does not exist
    element.toggleAttribute(attr, true)
  } else {
    // Set the attribute if the new value is different from the current value
    const currentVal = element.getAttribute(attr)
    const nextVal = `${val}`
    if (currentVal !== nextVal) {
      element.setAttribute(attr, nextVal)
    }
  }
}

const handleTemplateObject = (el: HTMLElement | SVGElement, fragment: TemplateObject) => {
  const { client, stylesheets } = fragment
  stylesheets.size && void updateShadowRootStyles(el.getRootNode() as ShadowRoot, stylesheets)
  const template = document.createElement('template')
  template.innerHTML = client
  return template.content
}

const sugar: Sugar = {
  render(...fragments) {
    const frag = fragments.map((fragment) =>
      isTypeOf<TemplateObject>(fragment, 'object') ? handleTemplateObject(this, fragment) : fragment,
    )
    this.replaceChildren(...frag)
  },
  insert(position, ...fragments) {
    const frag = fragments.map((fragment) =>
      isTypeOf<TemplateObject>(fragment, 'object') ? handleTemplateObject(this, fragment) : fragment,
    )
    position === 'beforebegin'
      ? this.before(...frag)
      : position === 'afterbegin'
      ? this.prepend(...frag)
      : position === 'beforeend'
      ? this.append(...frag)
      : this.after(...frag)
  },
  replace(...fragments) {
    const frag = fragments.map((fragment) =>
      isTypeOf<TemplateObject>(fragment, 'object') ? handleTemplateObject(this, fragment) : fragment,
    )
    this.replaceWith(...frag)
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
  clone(callback) {
    return (data) => {
      const clone =
        this instanceof HTMLTemplateElement
          ? (this.content.cloneNode(true) as DocumentFragment)
          : (this.cloneNode(true) as HTMLElement | SVGElement)
      callback($(clone), data)
      return clone
    }
  },
}

const assignedElements = new WeakSet<HTMLElement | SVGElement>()

const hasSugar = (element: HTMLElement | SVGElement): element is SugaredElement => {
  return assignedElements.has(element)
}

const assignSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  elements: (HTMLElement | SVGElement)[],
) => {
  const length = elements.length
  for (let i = 0; i < length; i++) {
    const el = elements[i]
    if (hasSugar(el)) continue
    const sugarEl = Object.assign(el, sugar)
    assignedElements.add(sugarEl)
  }
  return elements as SugaredElement<T>[]
}

export const $ =
  (context: DocumentFragment | HTMLElement | SVGElement | SugaredElement) =>
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(target: string, match: SelectorMatch = '=') => {
    return assignSugar<T>(
      Array.from(context.querySelectorAll<HTMLElement | SVGElement>(`[${dataTarget}${match}"${target}"]`)),
    )
  }
