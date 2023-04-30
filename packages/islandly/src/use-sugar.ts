import { Template } from '@plaited/jsx'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */
type Position = 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend';

export const sugar = {
  render(
    { stylesheets, content }: Template,
    position?: Position
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.innerHTML = [ ...stylesheets ].join('') + content
    if (position) {
      element.insertAdjacentElement(position, template)
      template.replaceWith(template.content)
      return element
    }
    element.replaceChildren(template.content)
    return element
  },
  replace({ stylesheets, content }: Template) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = document.createElement('template')
    template.innerHTML = [ ...stylesheets ].join('') + content
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
> = T & typeof sugar;

export const sugarForEach = {
  render(
    template: Template[],
    position?: Position
  ) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.render(template[i], position))
    return elements
  },
  replace(
    template: Template[]
  ) {
    const elements = this as unknown as SugaredElement[]
    elements.forEach(($el, i) => $el.replace(template[i]))
    return elements
  },
  attr(attrs: string | Record<string, string>, val?: string) {
    const elements = this as unknown as SugaredElement[]
    if (typeof attrs === 'string') {
      elements.forEach($el => $el.attr(attrs, val))
    } else {
      elements.forEach($el =>
        Object.entries(attrs)
          .forEach(([ key, val ]) => $el.attr(key, val))
      )
    }
    return elements
  },
}

export const useSugar = (element: HTMLElement | SVGElement): SugaredElement => {
  return Object.assign(element, sugar)
}
