import { Template } from './create-template.ts'

/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

const cache = new WeakMap<
  HTMLElement | SVGElement,
  NodeListOf<ChildNode> | ChildNode[]
>()

export const sugar = {
  render(tpl: Template, position?: 'afterbegin' | 'beforeend') {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.insertAdjacentHTML('afterbegin', tpl.content)
    let future: NodeListOf<ChildNode> | ChildNode[] =
      template.content.cloneNode(true).childNodes
    const past = cache.get(element) || []
    if (position === 'afterbegin') {
      future = [...future, ...past]
      cache.set(element, future)
      element.replaceChildren(...future)
      return element
    }
    if (position === 'beforeend') {
      future = [...future, ...past]
      cache.set(element, [...past, ...future])
      element.replaceChildren(...future)
      return element
    }
    cache.set(element, future)
    element.replaceChildren(...future)
    return element
  },
  attr(attr: string, val?: string) {
    const element = this as unknown as HTMLElement | SVGElement
    if (val === undefined) return element.getAttribute(attr)

    val == null
      ? element.removeAttribute(attr)
      : element.setAttribute(attr, val)

    return element
  },
} as const

export type SugaredElement<
  T extends HTMLElement | SVGElement = HTMLElement | SVGElement,
> = T & typeof sugar

export const sugarForEach = {
  render(template: Template, position?: 'afterbegin' | 'beforeend') {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el) => $el.render(template, position))
    return elements
  },
  attr(attrs: string | Record<string, string>, val?: string) {
    const elements = this as unknown as SugaredElement[]
    if (typeof attrs === 'string') {
      elements.forEach(($el) => $el.attr(attrs, val))
    } else {
      elements.forEach(($el) =>
        Object.entries(attrs)
          .forEach(([key, val]) => $el.attr(key, val))
      )
    }
    return elements
  },
}

export const render = (
  element: HTMLElement | SVGElement,
  tpl: Template,
  position?: 'afterbegin' | 'beforeend',
) => {
  const template = document.createElement('template')
  template.insertAdjacentHTML('afterbegin', tpl.content)
  let future: NodeListOf<ChildNode> | ChildNode[] =
    template.content.cloneNode(true).childNodes
  const past = cache.get(element) || []
  if (position === 'afterbegin') {
    future = [...future, ...past]
    cache.set(element, future)
    element.replaceChildren(...future)
    return element
  }
  if (position === 'beforeend') {
    future = [...future, ...past]
    cache.set(element, [...past, ...future])
    element.replaceChildren(...future)
    return element
  }
  cache.set(element, future)
  element.replaceChildren(...future)
  return element
}
