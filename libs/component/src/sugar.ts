import type {
  SugaredElement,
  Sugar,
  SelectorMatch,
  TemplateObject,
  Position,
  QuerySelector,
  BooleanAttributes,
  Clone,
} from '@plaited/component-types'
import { booleanAttrs, bpTarget } from '@plaited/jsx/utils'
import { isTypeOf } from '@plaited/utils'
import { defineRegistry } from './define-registry.js'
/**
 * Inspired by blingblingjs
 * (c) Adam Argyle - MIT
 * {@see https://github.com/argyleink/blingblingjs}
 */

export const cssCache = new WeakMap<ShadowRoot, Set<string>>()

const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
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
  const { client, stylesheets, registry } = fragment
  registry.size && defineRegistry(registry, true)
  stylesheets.size && void updateShadowRootStyles(shadowRoot, stylesheets)
  const template = document.createElement('template')
  template.innerHTML = client.join('')
  return template.content
}

const mount = (
  shadowRoot: ShadowRoot,
  el: HTMLElement | SVGElement,
  ...templates: ['replace' | Position | TemplateObject | DocumentFragment, ...(TemplateObject | DocumentFragment)[]]
) => {
  const content: DocumentFragment[] = []
  const [position] = templates
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const fragment = templates[i]
    if (isTypeOf<TemplateObject>(fragment, 'object')) content.push(handleTemplateObject(shadowRoot, fragment))
    if (fragment instanceof DocumentFragment) content.push(fragment)
  }
  position === 'beforebegin' ? el.before(...content)
  : position === 'afterbegin' ? el.prepend(...content)
  : position === 'beforeend' ? el.append(...content)
  : position === 'afterend' ? el.after(...content)
  : position === 'replace' ? el.replaceWith(...content)
  : el.replaceChildren(...content)
}

const getSugar = (shadowRoot: ShadowRoot): Sugar => ({
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

export const clone =
  (shadowRoot: ShadowRoot): Clone =>
  (template, callback) => {
    const content = handleTemplateObject(shadowRoot, template)
    return (data) => {
      const clone = content.cloneNode(true) as DocumentFragment
      callback($(shadowRoot, clone), data)
      return clone
    }
  }

const assignedElements = new WeakSet<HTMLElement | SVGElement>()

const hasSugar = (element: HTMLElement | SVGElement): element is SugaredElement => assignedElements.has(element)

const assignSugar = <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  shadowRoot: ShadowRoot,
  elements: (HTMLElement | SVGElement)[],
) => {
  const sugar = getSugar(shadowRoot)
  const length = elements.length
  for (let i = 0; i < length; i++) {
    const el = elements[i]
    if (hasSugar(el)) continue
    const sugarEl = Object.assign(el, sugar)
    assignedElements.add(sugarEl)
  }
  return elements as SugaredElement<T>[]
}

export const $ =
  (shadowRoot: ShadowRoot, context: DocumentFragment | ShadowRoot = shadowRoot): QuerySelector =>
  <T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(target: string, match: SelectorMatch = '=') =>
    assignSugar<T>(
      shadowRoot,
      Array.from(context.querySelectorAll<HTMLElement | SVGElement>(`[${bpTarget}${match}"${target}"]`)),
    )
