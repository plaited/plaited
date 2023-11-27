import type {
  PlaitedComponentConstructor,
  SugaredElement,
  Sugar,
  SelectorMatch,
  TemplateObject,
  Position,
  QuerySelector,
  CloneFragment,
  ForEachClone,
  BooleanAttributes,
} from '@plaited/component-types'
import { booleanAttrs, dataTarget } from '@plaited/jsx/utils'
import { isTypeOf } from '@plaited/utils'

/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

const cssCache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  // P1 first time dynamically setting stylesheets on instance add it to cssCache
  if (!cssCache.has(root)) {
    cssCache.set(root, new Set<string>([...(root.host.constructor as PlaitedComponentConstructor).stylesheets]))
  }
  const instanceStyles = cssCache.get(root)
  const newStyleSheets: CSSStyleSheet[] = []
  try {
    await Promise.all(
      [...stylesheets].map(async (styles) => {
        if (instanceStyles?.has(styles)) return
        const sheet = new CSSStyleSheet()
        instanceStyles?.add(styles)
        const nextSheet = await sheet.replace(styles)
        newStyleSheets.push(nextSheet)
      }),
    )
  } catch (error) {
    console.error(error)
  }
  if (newStyleSheets.length) root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...newStyleSheets]
}

const updateAttributes = (element: HTMLElement | SVGElement, attr: string, val: string | null | number | boolean) => {
  // Remove the attribute if val is null or undefined, and it currently exists
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  // Set the attribute if it is a boolean attribute and it does not exist
  if (booleanAttrs.has(attr as BooleanAttributes)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if the new value is different from the current value
  element.setAttribute(attr, `${val}`)
}

const handleTemplateObject = (shadowRoot: ShadowRoot, fragment: TemplateObject) => {
  const { client, stylesheets } = fragment
  stylesheets.size && void updateShadowRootStyles(shadowRoot, stylesheets)
  const template = document.createElement('template')
  template.innerHTML = client.join('')
  return template.content
}

const handleClone = (shadowRoot: ShadowRoot, fragment: CloneFragment) => {
  const [content, data, cb] = fragment
  const frags: DocumentFragment[] = []
  const length = data.length
  for (let i = 0; i < length; i++) {
    const clone = content.cloneNode(true) as DocumentFragment
    cb($(shadowRoot, clone), data[i])
    frags.push(clone)
  }
  return frags
}

const mount = (
  shadowRoot: ShadowRoot,
  el: HTMLElement | SVGElement,
  ...templates: ['replace' | Position | TemplateObject | CloneFragment, ...(TemplateObject | CloneFragment)[]]
) => {
  const content: DocumentFragment[] = []
  const [position] = templates
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const fragment = templates[i]
    if (isTypeOf<TemplateObject>(fragment, 'object')) content.push(handleTemplateObject(shadowRoot, fragment))
    if (isTypeOf<CloneFragment>(fragment, 'array')) content.push(...handleClone(shadowRoot, fragment))
  }
  position === 'beforebegin' ? el.before(...content)
  : position === 'afterbegin' ? el.prepend(...content)
  : position === 'beforeend' ? el.append(...content)
  : position === 'afterend' ? el.after(...content)
  : position === 'replace' ? el.replaceWith(...content)
  : el.replaceChildren(...content)
}

export const clone =
  (shadowRoot: ShadowRoot) =>
  (template: TemplateObject): ForEachClone =>
  (data, cb) => [handleTemplateObject(shadowRoot, template), data, cb]

const sugar = (shadowRoot: ShadowRoot): Sugar => ({
  render(first, ...templates) {
    mount(shadowRoot, this, first, ...templates)
  },
  insert(...templates) {
    mount(shadowRoot, this, ...templates)
  },
  replace(...templates) {
    mount(shadowRoot, this, 'replace', ...templates)
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
})

const assignedElements = new WeakSet<HTMLElement | SVGElement>()

const hasSugar = (element: HTMLElement | SVGElement): element is SugaredElement => assignedElements.has(element)

const assignSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  shadowRoot: ShadowRoot,
  elements: (HTMLElement | SVGElement)[],
) => {
  const length = elements.length
  for (let i = 0; i < length; i++) {
    const el = elements[i]
    if (hasSugar(el)) continue
    const sugarEl = Object.assign(el, sugar(shadowRoot))
    assignedElements.add(sugarEl)
  }
  return elements as SugaredElement<T>[]
}

export const $ =
  (
    shadowRoot: ShadowRoot,
    context: DocumentFragment | HTMLElement | SVGElement | SugaredElement = shadowRoot,
  ): QuerySelector =>
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(target: string, match: SelectorMatch = '=') =>
    assignSugar<T>(
      shadowRoot,
      Array.from(context.querySelectorAll<HTMLElement | SVGElement>(`[${dataTarget}${match}"${target}"]`)),
    )
