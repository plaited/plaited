import { Template } from '@plaited/jsx'
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
  let newStyles = ''
  for(const sheet of stylesheets) {
    if(content.includes(sheet)) continue
    newStyles += sheet
  }
  style.append(newStyles)
}

const prepareTemplate = (element:HTMLElement | SVGElement, { stylesheets, content }: Template) => {
  const template = document.createElement('template')
  const root = element.getRootNode()
  let styles = ''
  if(root instanceof ShadowRoot && stylesheets.size ) {
    updateShadowRootStyles(root, stylesheets)
  } else if(stylesheets.size) {
    styles =  `<style>${[ ...stylesheets ].join('')}</style>`
  }
  template.innerHTML = styles + content
  return template
}


export const sugar = {
  render(
    tpl: Template,
    position?: Position
  ) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = prepareTemplate(element, tpl)
    if (position) {
      element.insertAdjacentElement(position, template)
      template.replaceWith(template.content)
      return element
    }
    element.replaceChildren(template.content)
    return element
  },
  replace(tpl: Template) {
    const element = this as unknown as HTMLElement | SVGElement
    const template = prepareTemplate(element, tpl)
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
