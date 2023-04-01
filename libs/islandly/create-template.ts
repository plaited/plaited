// deno-lint-ignore-file no-explicit-any
import { canUseDOM, escape, trueTypeOf } from '../utils/mod.ts'
import { Primitive } from './types.ts'
import {
  booleanAttrs,
  dataTrigger as _dataTrigger,
  primitives,
  svgTags,
  voidTags,
} from './constants.ts'

type BaseProps = {
  class?: never
  for?: never
  shadowRootMode?: 'open' | 'closed'
  shadowRootDelegatesFocus?: boolean
  slot?: string
  className?: string
  htmlFor?: string
  styles?: string | Set<string>
  /** setting trusted to true will disable all escaping security policy measures for this node template */
  trusted?: boolean
  dataTrigger?: Record<string, string>
  dataTarget?: string
  style?: Record<string, string>
  key?: string
}

type BrowserProps<
  T extends Record<string, any> = Record<string, any>,
> = BaseProps & {
  children?: (BrowserElement | string)[]
} & T
type ServerProps<
  T extends Record<string, any> = Record<string, any>,
> = BaseProps & {
  children?: (ServerElement | string)[]
} & T

interface BrowserElement {
  (): HTMLElement | SVGElement
  slot?: boolean
}

interface ServerElement {
  (): string
  slot?: boolean
}

export type PlaitedElement = BrowserElement | ServerElement
export type Tag =
  | string
  | `${string}-${string}`
  | BrowserElement
  | ServerElement

export type Props<
  T extends Record<string, any> = Record<string, any>,
> =
  | BrowserProps<T>
  | ServerProps<T>

interface CreateServerTemplate {
  <T extends Record<string, any>>(
    tag: Exclude<Tag, BrowserElement>,
    props: ServerProps<T>,
  ): ServerElement
}

interface CreateBrowserTemplate {
  <T extends Record<string, any>>(
    tag: Exclude<Tag, ServerElement>,
    props: BrowserProps<T>,
  ): BrowserElement
}

interface CreateTemplate {
  <T extends Record<string, any>>(
    tag: Tag,
    props?: Props<T>,
  ): PlaitedElement
}

/** custom element tagName regex */
const customElementRegex = /^[a-z]+\-[a-z]+(?:\-[a-z]+)*$/

/** create server element string representation */
const serverTemplate = (
  tag: string,
  attrs: string[] = [],
  children: string[],
) => `<${[tag, ...attrs].join(' ')}>${children.join(' ')}</${tag}>`

/** createTemplate function used for ssr */
const createServerTemplate: CreateServerTemplate = (
  tag,
  {
    shadowRootMode = 'open',
    shadowRootDelegatesFocus = true,
    trusted,
    children = [],
    styles,
    dataTrigger,
    className,
    htmlFor,
    style,
    key: _,
    ...attributes
  },
) => {
  const template = () => {
    /** If the tag is script we must explicitly pass trusted */
    if (tag === 'script' && !trusted) {
      throw new Error('Script tag not allowed unless \'trusted\' property set')
    }

    /** Now to determine what our root element is */
    const root = typeof tag === 'string' ? tag.toLowerCase() : tag()

    const rootAttrs: string[] = []

    /** if we have dataTrigger attribute wire up formatted correctly*/
    dataTrigger && rootAttrs.push(
      `${_dataTrigger}="${
        Object.entries(dataTrigger)
          .map<string>(([ev, req]) => `${ev}->${req}`)
          .join(' ')
      }"`,
    )
    /** if we have className add it to Element */
    className && rootAttrs.push(`class="${className}"`)
    /** if we have htmlFor add it to Element */
    htmlFor && rootAttrs.push(`for="${htmlFor}"`)
    /** if we have style add it to element */
    style && rootAttrs.push(`style="${
      Object.entries(style)
        .map<string>(([prop, val]) => `${prop}:${val};`)
        .join(' ')
    }"`)
    /** next we want to loops through our attributes */
    for (const key in attributes) {
      /** all events our delegated via the data-trigger attribute so we want
       * throw on attempts to provide `on` attributes
       */
      if (key.startsWith('on')) {
        throw new Error('Attributes starting with \'on\' are not allowed.')
      }
      if (!primitives.has(trueTypeOf(attributes[key]))) {
        throw new Error(
          `Attributes not declared in BaseProps must be of type Primitive: ${key} is not primitive`,
        )
      }
      /** grab the value from the attribute */
      const value: Primitive = attributes[key]
      /** convert camelCase attributes into dash-case ones */
      const dashKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
      /** test for and handle boolean attributes */
      if (booleanAttrs.has(dashKey)) {
        rootAttrs.push(`${dashKey}`)
        continue
      }
      /** set the value so long as it's not nullish in we use the formatted value  */
      const formattedValue = value ?? ''
      /** handle the rest of the attributes */
      rootAttrs.push(
        `${dashKey}="${
          trusted ? `${formattedValue}` : escape(`${formattedValue}`)
        }"`,
      )
    }

    /** Our tag is a void tag so we can return it once we apply attributes */
    if (typeof root === 'string' && voidTags.has(root)) {
      return `<${[root, ...rootAttrs].join(' ')}/>`
    }

    /** Test if the the tag is a string and if it's a custom element */
    const isCustomElement = customElementRegex.test(root)

    /** If our template is for a custom element we're going to create a
     * declarative shadow dom
     */
    const templateAttrs: string[] = []
    const templateChildren: string[] = []
    if (isCustomElement) {
      /** Set the mode of the shadowDom */
      templateAttrs.push(`shadowrootmode="${shadowRootMode}"`)
      /** We destructured out the styles attribute as it's only for
       * custom elements declarative shadow dom  we create the style node
       * append the styles as the first child of the declarative shadowDom template */
      if (styles) {
        templateChildren.push(
          serverTemplate(
            'style',
            undefined,
            typeof styles === 'string' ? [styles] : [...styles],
          ),
        )
      }
      /** We generally want to delegate focus to the first focusable element in
       * custom elements
       */
      templateAttrs.push(
        `shadowrootdelegatesfocus="${shadowRootDelegatesFocus}"`,
      )
      /** now that we've configured our declarative shadowDom
       * we append it to our root element.
       */
    }
    const rootChildren: string[] = []
    /** time to append the children to our template if we have em*/
    const length = children.length
    for (let i = 0; i < length; i++) {
      const child = children[i]
      /** P1 Child is and string and custom element */
      if (
        isCustomElement &&
        typeof child === 'string'
      ) {
        templateChildren.push(trusted ? child : escape(child))
        continue
      }
      /** P2 string not custom element */
      if (typeof child === 'string') {
        rootChildren.push(trusted ? child : escape(child))
        continue
      }
      /** P3 ServerElement and and the child is slotted */
      if (isCustomElement && child.slot) {
        rootChildren.push(child())
        continue
      }
      /** P4 ServerElement and custom element */
      if (isCustomElement) {
        templateChildren.push(child())
        continue
      }
      /**  P5 default use root tag*/
      rootChildren.push(child())
    }
    const template: string = serverTemplate(
      'template',
      templateAttrs,
      templateChildren,
    )
    return serverTemplate(root, rootAttrs, [template, ...rootChildren])
  }
  template['slot'] = !!attributes?.slot
  return template
}

/** createTemplate function used in browser */
const createBrowserTemplate: CreateBrowserTemplate = (
  tag,
  {
    shadowRootMode = 'open',
    shadowRootDelegatesFocus = true,
    trusted,
    children = [],
    styles,
    dataTrigger,
    className,
    htmlFor,
    style,
    key: _,
    ...attributes
  },
) => {
  const template = () => {
    /** If the tag is script we must explicitly pass trusted */
    if (tag === 'script' && !trusted) {
      throw new Error('Script tag not allowed unless \'trusted\' property set')
    }
    /** Test if the the tag is a string and if it's a custom element */
    const isCustomElement = typeof tag === 'string' &&
      customElementRegex.test(tag.toLowerCase())

    /** Now to determine what our root element is */
    const root = typeof tag === 'string' && svgTags.has(tag.toLowerCase())
      ? document.createElementNS(
        'http://www.w3.org/2000/svg',
        tag.toLowerCase(),
      )
      : typeof tag === 'string'
      ? document.createElement(tag.toLowerCase())
      : tag()

    /** if we have dataTrigger attribute wire up formatted correctly*/
    dataTrigger && root.setAttribute(
      _dataTrigger,
      Object.entries(dataTrigger)
        .map<string>(([ev, req]) => `${ev}->${req}`)
        .join(' '),
    )
    /** if we have className add it to Element */
    className && root.setAttribute('class', className)
    /** if we have htmlFor add it to Element */
    htmlFor && root.setAttribute('for', htmlFor)
    /** if we have style add it to element */
    style &&
      root.setAttribute(
        'style',
        Object.entries({ ...style, ...root.style })
          .map<string>(([prop, val]) => `${prop}:${val};`)
          .join(' '),
      )
    /** next we want to loops through our attributes */
    for (const key in attributes) {
      /** all events our delegated via the data-trigger attribute so we want
       * throw on attempts to provide `on` attributes
       */
      if (key.startsWith('on')) {
        throw new Error('Attributes starting with \'on\' are not allowed.')
      }
      /** grab the value from the attribute */
      const value: Primitive = attributes[key]
      /** convert camelCase attributes into dash-case ones */
      const dashKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
      /** test for and handle boolean attributes */
      if (booleanAttrs.has(dashKey)) {
        root.toggleAttribute(dashKey, !!value)
        continue
      }
      const formattedValue = value ??
        '' /** set the value so long as it's not nullish in we use the formatted value  */
      root.setAttribute(
        dashKey,
        trusted ? `${formattedValue}` : escape(`${formattedValue}`),
      )
    }

    /** Our tag is a void tag so we can skip
     * to returning it once we apply  attributes */
    if (typeof tag === 'string' && voidTags.has(tag.toLowerCase())) {
      return root
    }
    /** If our template is for a custom element we're going to create a
     * declarative shadow dom
     */
    let customElementTemplate: HTMLTemplateElement | undefined
    if (isCustomElement) {
      /** The declarative shadowDom template */
      customElementTemplate = document.createElement('template')
      /** Set the mode of the shadowDom */
      customElementTemplate.setAttribute(
        'shadowrootmode',
        shadowRootMode,
      )
      /** We destructured out the styles attribute as it's only for
       * custom elements declarative shadow dom  we create the style node
       * append the styles as the first child of the declarative shadowDom template */
      if (styles) {
        const style = document.createElement('style')
        style.append(typeof styles === 'string' ? styles : [...styles].join(''))
        customElementTemplate.content.append(style)
      }
      /** We generally want to delegate focus to the first focusable element in
       * custom elements
       */
      customElementTemplate.toggleAttribute(
        'shadowrootdelegatesfocus',
        shadowRootDelegatesFocus,
      )
      /** now that we've configured our declarative shadowDom
       * we append it to our root element.
       */
      root.appendChild(customElementTemplate)
    }
    /** time to append the children to our template if we have em*/
    const length = children.length
    for (let i = 0; i < length; i++) {
      const child = children[i]
      /** P1 Child is and string and custom element */
      if (
        customElementTemplate &&
        typeof child === 'string'
      ) {
        customElementTemplate.content.append(trusted ? child : escape(child))
        continue
      }
      /** P2 string not custom element */
      if (typeof child === 'string') {
        root?.append(trusted ? child : escape(child))
        continue
      }
      /** P3 BrowserElement and the child is slotted */
      if (customElementTemplate && child.slot) {
        root.append(child())
        continue
      }
      /** P4 BrowserElement and custom element */
      if (customElementTemplate) {
        customElementTemplate.content.append(child())
        continue
      }
      /**  P5 default use root tag*/
      root.appendChild(child())
    }
    return root
  }
  template['slot'] = !!attributes?.slot
  return template
}

export const createTemplate: CreateTemplate = (tag, props) => {
  if (!canUseDOM()) {
    return createServerTemplate(
      tag as Exclude<Tag, BrowserElement>,
      (props || {}) as ServerProps & Record<string, Primitive>,
    )
  }
  return createBrowserTemplate(
    tag as Exclude<Tag, ServerElement>,
    (props || {}) as BrowserProps & Record<string, Primitive>,
  )
}

export { createTemplate as h }

createBrowserTemplate('min-com', { children: [''] })
