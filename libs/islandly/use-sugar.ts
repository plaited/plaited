import { PlaitedElement } from './create-template.ts'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */
type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'
export const sugar = {
  render(
    data: Record<string, any> | Record<string, any>[],
    tpl: PlaitedElement,
    position?: Position,
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.innerHTML = Array.isArray(data)
      ? data.map((d) => tpl(d).content).join('')
      : tpl(data).content
    if (position) {
      element.insertAdjacentElement(position, template)
      template.replaceWith(template.content.cloneNode(true))
      return element
    }
    element.replaceChildren(template.content.cloneNode(true))
    return element
  },
  replace(
    data: Record<string, any> | Record<string, any>[],
    tpl: PlaitedElement,
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.innerHTML = Array.isArray(data)
      ? data.map((d) => tpl(d).content).join('')
      : tpl(data).content
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
  render(
    data: Record<string, any>[],
    template: PlaitedElement,
    position?: Position,
  ) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.render(data[i], template, position))
    return elements
  },
  replace(data: Record<string, any>[], template: PlaitedElement) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.replace(data[i], template))
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

export const useSugar = (element: HTMLElement | SVGElement) => {
  Object.assign(element, sugar)
}
