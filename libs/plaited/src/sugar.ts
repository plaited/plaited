import { Template, booleanAttrs  } from '@plaited/jsx'
import { Position } from './types.js'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

const cache = new WeakMap<ShadowRoot, HTMLStyleElement>()

const updateShadowRootStyles = (root: ShadowRoot, stylesheets: Set<string> ) => {
  const style = cache.get(root) || root.querySelector('style')
  if(!style) {
    const style = document.createElement('style')
    style.append([ ...stylesheets ].join(''))
    root.prepend(style)
    cache.set(root, style)
    return
  }
  if(!cache.has(root)) cache.set(root, style)
  const content = style.textContent
  const newStyles: string[] = []
  for(const sheet of stylesheets) {
    if(content.includes(sheet)) continue
    newStyles.push(sheet)
  }
  style.append(newStyles.join(''))
}

let parser: {
  parseFromString(string: string, type: DOMParserSupportedType, options: {
    includeShadowRoots: boolean,
  }): Document;
}

if (typeof window !== 'undefined' && window.DOMParser) {
  parser = new DOMParser()
}

export const prepareTemplate = (root:ShadowRoot, { stylesheets, content }: Template): HTMLTemplateElement => {
  if(stylesheets.size) {
    updateShadowRootStyles(root, stylesheets)
  }
  const fragment = parser.parseFromString(`<template>${content}</template>`, 'text/html', {
    includeShadowRoots: true,
  })
  return fragment.head.firstChild as HTMLTemplateElement
}

const updateAttributes = (element: HTMLElement | SVGElement, attr: string, val: string | null | number | boolean) => {
  if (
    val == null &&
    element.hasAttribute(attr)
  ) {
    // Remove the attribute if val is null or undefined, and it currently exists
    element.removeAttribute(attr)
  } else if(
    booleanAttrs.has(attr) &&
    !element.hasAttribute(attr)
  ) {
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
  render(
    tpl: Template,
    position?: Position,
    raf: boolean = true
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = prepareTemplate(element.getRootNode() as ShadowRoot, tpl)
    if (position) {
      raf ? requestAnimationFrame(() => {
        element.insertAdjacentElement(position, template).replaceWith(template.content)
      }) : element.insertAdjacentElement(position, template).replaceWith(template.content)
      return element
    }
    raf ? requestAnimationFrame(() => {
      element.replaceChildren(template.content)
    }) : element.replaceChildren(template.content)
    return element
  },
  replace(tpl: Template, raf: boolean = true) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = prepareTemplate(element.getRootNode() as ShadowRoot, tpl)
    raf ? requestAnimationFrame(() => {
      element.replaceWith(template.content)
    }) : element.replaceWith(template.content)
  },
  attr(attr: string, val?: string | null | number | boolean, raf: boolean = true) {
    const element = this as unknown as HTMLElement | SVGElement
    // Return the attribute value if val is not provided
    if (val === undefined) return element.getAttribute(attr)
    raf
      ? requestAnimationFrame(() => updateAttributes(element, attr, val))
      : updateAttributes(element, attr, val)
    return element
  },
} as const

export type SugaredElement<
  T extends HTMLElement | SVGElement = HTMLElement | SVGElement,
> = T & typeof sugar;


type SugarForEach = {
  render(
    template: Template[],
    position?: Position
  ): SugaredElement<HTMLElement | SVGElement>[];
  replace(template: Template[]): SugaredElement<HTMLElement | SVGElement>[];
  attr(
    attrs: Record<string, string | null | number | boolean>,
    val?:never
  ): SugaredElement<HTMLElement | SVGElement>[]
  attr(
    attrs: string,
    val: string | null | number | boolean
  ): SugaredElement<HTMLElement | SVGElement>[]
}

const sugarForEach: SugarForEach = {
  render(
    template: Template[],
    position?: Position
  ) {
    const elements = this as unknown as SugaredElement[]
    requestAnimationFrame(() => {
      elements.forEach(($el, i) => $el.render(template[i], position, false))
    })
    return elements
  },
  replace(
    template: Template[]
  ) {
    const elements = this as unknown as SugaredElement[]
    requestAnimationFrame(() => {
      elements.forEach(($el, i) => $el.replace(template[i], false))
    })
    return elements
  },
  // This method only allows for batch updates of element attributes no reads
  attr(
    attrs: string | Record<string, string | null | number | boolean>,
    val?: string | null | number | boolean
  ) {
    const elements = this as unknown as SugaredElement[]
    requestAnimationFrame(() => {
      elements.forEach($el => {
        if (typeof attrs === 'string') {
          $el.attr(attrs, val, false)
        } else {
          Object.entries(attrs).forEach(([ key, val ]) => {
            $el.attr(key, val, false)
          })
        }
      })
    })
    return elements
  },
}

const assignedElements = new WeakSet<HTMLElement | SVGElement>()

const hasSugar =  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T
): element is SugaredElement<T> => {
  return assignedElements.has(element)
}

export const assignSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T
): SugaredElement<T>=> {
  if(hasSugar(element)) return element
  const sugarEl = Object.assign(element, sugar)
  assignedElements.add(sugarEl)
  return sugarEl
}

export const assignSugarForEach = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  nodes: NodeListOf<T>
) => {    
  const elements: SugaredElement<T>[] = []
  nodes.forEach(element => elements.push(assignSugar<T>(element)))
  return Object.assign(elements, sugarForEach)
}
