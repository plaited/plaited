import { isTypeOf } from '@plaited/utils'
import type {
  SugaredElement,
  Sugar,
  SelectorMatch,
  TemplateObject,
  QuerySelector,
  BooleanAttributes,
  Clone,
} from '../types.js'
import { booleanAttrs, bpTarget } from '../jsx/constants.js'
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

const updateAttributes = (element: Element, attr: string, val: string | null | number | boolean) => {
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

const mapTemplates = (shadowRoot: ShadowRoot, templates: (TemplateObject | DocumentFragment | Element | string)[]) => {
  const content: (DocumentFragment | string | Element)[] = []
  const length = templates.length
  for (let i = 0; i < length; i++) {
    const fragment = templates[i]
    if (isTypeOf<TemplateObject>(fragment, 'object')) {
      content.push(handleTemplateObject(shadowRoot, fragment))
    } else {
      content.push(fragment)
    }
  }
  return content
}

const getSugar = (shadowRoot: ShadowRoot): Sugar => ({
  render(...templates) {
    this.replaceChildren(...mapTemplates(shadowRoot, templates))
  },
  insert(position, ...templates) {
    const content = mapTemplates(shadowRoot, templates)
    position === 'beforebegin' ? this.before(...content)
    : position === 'afterbegin' ? this.prepend(...content)
    : position === 'beforeend' ? this.append(...content)
    : this.after(...content)
  },
  replace(...templates) {
    this.replaceWith(...mapTemplates(shadowRoot, templates))
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

const assignedElements = new WeakSet<Element>()
const hasSugar = (element: Element): element is SugaredElement => assignedElements.has(element)
const assignSugar = <T extends Element = Element>(sugar: Sugar, elements: Element[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) {
    const el = elements[i]
    if (hasSugar(el)) continue
    const sugarEl = Object.assign(el, sugar)
    assignedElements.add(sugarEl)
  }
  return elements as SugaredElement<T>[]
}

const sugarRoots = new WeakMap<ShadowRoot, Sugar>()
export const $ = (
  shadowRoot: ShadowRoot,
  context: DocumentFragment | ShadowRoot | Element = shadowRoot,
): QuerySelector => {
  const sugar =
    sugarRoots.get(shadowRoot) ?? (sugarRoots.set(shadowRoot, getSugar(shadowRoot)).get(shadowRoot) as Sugar)
  return <T extends Element = Element>(target: string, match: SelectorMatch = '=') =>
    assignSugar<T>(sugar, Array.from(context.querySelectorAll<Element>(`[${bpTarget}${match}"${target}"]`)))
}

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
