import type { Template } from '@plaited/jsx'
import type { PlaitedComponentConstructor } from './types.js'
import { booleanAttrs } from '@plaited/jsx/utils'
import { canUseDOM } from '@plaited/utils'

type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

const cache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  // P1 first time dynamically setting stylesheets on instance add it to cache
  if (!cache.has(root)) cache.set(root, new Set<string>())
  // P2 get default styles if they exist on instance
  const defaultStyles: undefined | Set<string> = (root.host.constructor as PlaitedComponentConstructor).stylesheets
  const instanceStyles = cache.get(root)
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

const sugar = {
  render({ stylesheets, node }: Template, position?: Position) {
    const element = this as unknown as HTMLElement | SVGElement
    if (stylesheets.size) void updateShadowRootStyles(element.getRootNode() as ShadowRoot, stylesheets)
    if (position) {
      const template = document.createElement('template')
      element.insertAdjacentElement(position, template)?.replaceWith(node)
      return element
    }
    element.replaceChildren(node)
    return element
  },
  replace({stylesheets, node}: Template) {
    const element = this as unknown as HTMLElement | SVGElement
    if (stylesheets.size) void updateShadowRootStyles(element.getRootNode() as ShadowRoot, stylesheets)
    element.replaceWith(node)
  },
  attr(attr: string, val?: string | null | number | boolean) {
    const element = this as unknown as HTMLElement | SVGElement
    // Return the attribute value if val is not provided
    if (val === undefined) return element.getAttribute(attr)
    updateAttributes(element, attr, val)
    return element
  },
} as const

export type SugaredElement<T extends HTMLElement | SVGElement = HTMLElement | SVGElement> = T & typeof sugar

type SugarForEach = {
  render(template: Template[], position?: Position): SugaredElement<HTMLElement | SVGElement>[]
  replace(template: Template[]): SugaredElement<HTMLElement | SVGElement>[]
  attr(attrs: Record<string, string | null | number | boolean>, val?: never): SugaredElement<HTMLElement | SVGElement>[]
  attr(attrs: string, val: string | null | number | boolean): SugaredElement<HTMLElement | SVGElement>[]
}

const sugarForEach: SugarForEach = {
  render(template: Template[], position?: Position) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.render(template[i], position))
    return elements
  },
  replace(template: Template[]) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.replace(template[i]))
    return elements
  },
  // This method only allows for batch updates of element attributes no reads
  attr(attrs: string | Record<string, string | null | number | boolean>, val?: string | null | number | boolean) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el) => {
      if (typeof attrs === 'string') {
        $el.attr(attrs, val)
      } else {
        Object.entries(attrs).forEach(([key, val]) => {
          $el.attr(key, val)
        })
      }
    })
    return elements
  },
}

const assignedElements = new WeakSet<HTMLElement | SVGElement>()

const hasSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
): element is SugaredElement<T> => {
  return assignedElements.has(element)
}

export const assignSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
): SugaredElement<T> => {
  if (hasSugar(element)) return element
  const sugarEl = Object.assign(element, sugar)
  assignedElements.add(sugarEl)
  return sugarEl
}

export const assignSugarForEach = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  nodes: NodeListOf<T>,
) => {
  const elements: SugaredElement<T>[] = []
  nodes.forEach((element) => elements.push(assignSugar<T>(element)))
  return Object.assign(elements, sugarForEach)
}
