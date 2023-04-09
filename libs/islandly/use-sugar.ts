// deno-lint-ignore-file no-explicit-any
import { PlaitedElement } from './create-template.ts'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */
type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'
export const sugar = {
  render<T extends Record<string, any>>(
    data: T | T[],
    tpl: PlaitedElement<T>,
    position?: Position,
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    Array.isArray(data)
      ? template.content.append(...data.map((d) => tpl(d).content))
      : template.content.append(tpl(data).content)

    if (position) {
      element.insertAdjacentElement(position, template)
      template.replaceWith(template.content)
      return element
    }
    element.replaceChildren(template.content)
    return element
  },
  replace<T extends Record<string, any>>(
    data: T | T[],
    tpl: PlaitedElement<T>,
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    Array.isArray(data)
      ? template.content.append(...data.map((d) => tpl(d).content))
      : template.content.append(tpl(data).content)
    element.replaceWith(template.content)
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
  render<T extends Record<string, any>>(
    data: T[],
    template: PlaitedElement<T>,
    position?: Position,
  ) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.render(data[i], template, position))
    return elements
  },
  replace<T extends Record<string, any>>(
    data: T[],
    template: PlaitedElement<T>,
  ) {
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
  return element
}
