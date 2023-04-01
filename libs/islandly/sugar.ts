import { PlaitedElement } from './create-template.ts'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */
export const sugar = {
  render(...templates: PlaitedElement[]) {
    const element = this as unknown as HTMLElement | SVGElement
    const tpl = document.createElement('template')
    tpl.content.append(
      ...templates.map((template) => template() as HTMLElement | SVGElement),
    )
    const future = tpl.content.cloneNode(true)
    element.replaceChildren(future)
    return element
  },
  insert(position: 'afterbegin' | 'beforeend', ...templates: PlaitedElement[]) {
    const element = this as unknown as HTMLElement | SVGElement
    const tpl = document.createElement('template')
    tpl.content.append(
      ...templates.map((template) => template() as HTMLElement | SVGElement),
    )
    const future = tpl.content.cloneNode(true)
    position === 'afterbegin' ? element.prepend(future) : element.append(future)
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
  render(...templates: PlaitedElement[]) {
    const elements = this as unknown as SugaredElement[]
    const tpl = document.createElement('template')
    tpl.content.append(
      ...templates.map((template) => template() as HTMLElement | SVGElement),
    )
    const future = tpl.content.cloneNode(true)
    elements.forEach(($el) => $el.replaceChildren(future))
    return elements
  },
  insert(position: 'afterbegin' | 'beforeend', ...templates: PlaitedElement[]) {
    const elements = this as unknown as SugaredElement[]
    const tpl = document.createElement('template')
    tpl.content.append(
      ...templates.map((template) => template() as HTMLElement | SVGElement),
    )
    const future = tpl.content.cloneNode(true)
    elements.forEach(($el) =>
      position === 'afterbegin' ? $el.prepend(future) : $el.append(future)
    )
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
