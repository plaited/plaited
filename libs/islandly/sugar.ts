import { Template } from './create-template.ts'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'
export const sugar = {
  render(
    tpl: Template,
    position?: Position,
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.innerHTML = tpl.content
    if (position) {
      element.insertAdjacentElement(position, template)
      template.replaceWith(template.content.cloneNode(true))
      return element
    }
    element.replaceChildren(template.content.cloneNode(true))
    return element
  },
  replace(tpl: Template) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.innerHTML = tpl.content
    element.replaceWith(template.content.cloneNode(true))
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
  render(template: Template, position?: Position) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el) => $el.render(template, position))
    return elements
  },
  replace(template: Template) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el) => $el.replace(template))
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
  position?: Position,
) => {
  const template = document.createElement('template')
  template.innerHTML = tpl.content
  if (position) {
    element.insertAdjacentElement(position, template)
    template.replaceWith(template.content.cloneNode(true))
    return element
  }
  element.replaceChildren(template.content.cloneNode(true))
  return element
}
