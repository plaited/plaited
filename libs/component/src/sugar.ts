import type { PlaitedComponentConstructor, SugaredElement, Sugar } from './types.js'
import { Template } from '@plaited/jsx'
import { booleanAttrs } from '@plaited/jsx/utils'
import { isTypeOf } from '@plaited/utils'

/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

const cssCache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  // P1 first time dynamically setting stylesheets on instance add it to cssCache
  if (!cssCache.has(root)) cssCache.set(root, new Set<string>())
  // P2 get default styles if they exist on instance
  const defaultStyles: undefined | Set<string> = (root.host.constructor as PlaitedComponentConstructor).stylesheets
  const instanceStyles = cssCache.get(root)
  const newStyleSheets: CSSStyleSheet[] = []
  try {
    await Promise.all(
      [...stylesheets].map(async (styles) => {
        if (defaultStyles?.has(styles) || instanceStyles?.has(styles)) return
        const sheet = new CSSStyleSheet()
        instanceStyles?.add(styles)
        const nextSheet = await sheet.replace(styles)
        newStyleSheets.push(nextSheet)
      }),
    )
  } catch (error) {
    console.error(error)
  }
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...newStyleSheets]
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

const sugar: Sugar = {
  render({ content, stylesheets }) {
    stylesheets.size && void updateShadowRootStyles(this.getRootNode() as ShadowRoot, stylesheets)
    const template = document.createElement('template')
    template.innerHTML = content
    this.replaceChildren(template.content)
  },
  insert(position, { content, stylesheets }) {
    stylesheets.size && void updateShadowRootStyles(this.getRootNode() as ShadowRoot, stylesheets)
    this.insertAdjacentHTML(position, content)
  },
  replace({ content, stylesheets }) {
    stylesheets.size && void updateShadowRootStyles(this.getRootNode() as ShadowRoot, stylesheets)
    const template = document.createElement('template')
    template.innerHTML = content
    this.replaceWith(template.content)
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
}

const assignedElements = new WeakSet<HTMLElement | SVGElement>()

const hasSugar = (element: HTMLElement | SVGElement): element is SugaredElement => {
  return assignedElements.has(element)
}

export const assignSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
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
