import { escape, trueTypeOf } from '../utils/mod.ts'
import { Primitive } from './types.ts'
import {
  booleanAttrs,
  dataTrigger as _dataTrigger,
  primitives,
  voidTags,
} from './constants.ts'

export type Template = {
  content: string
  stylesheets: Set<string>
}

export type PlaitedElement<
  T extends Record<string, Primitive | Children> = Record<
    string,
    Primitive | Children
  >,
> = (attrs: Attrs<T>) => Template

type Children = (string | Template)[] | (string | Template)

export type BaseAttrs = {
  class?: never
  className?: string
  children?: Children
  dataTarget?: string
  dataTrigger?: string
  for?: never
  htmlFor?: string
  key?: string
  shadowRootMode?: 'open' | 'closed'
  shadowRootDelegatesFocus?: boolean
  slots?: Children
  stylesheet?: string
  /** setting trusted to true will disable all escaping security policy measures for this node template */
  trusted?: boolean
  style?: string
}

export type Attrs<
  T extends Record<string, Primitive | Children> = Record<
    string,
    Primitive | Children
  >,
> =
  & BaseAttrs
  & T

export type Tag =
  | string
  | `${string}-${string}`
  | PlaitedElement

interface CreateTemplate {
  <T extends Record<string, Primitive | Children>>(
    tag: Tag,
    attrs: Attrs<T>,
  ): Template
}

/** custom element tagName regex */
const customElementRegex = /^[a-z]+\-[a-z]+(?:\-[a-z]+)*$/

/** create server element string representation */
const joinParts = (
  tag: string,
  attrs: string[] = [],
  children: string[],
) => `<${[tag, ...attrs].join(' ')}>${children.join('')}</${tag}>`

/** createTemplate function used for ssr */
//@ts-ignore: temp to commit
export const createTemplate: CreateTemplate = (tag, attrs) => {
  const {
    shadowRootMode = 'open',
    children: _children,
    shadowRootDelegatesFocus = true,
    trusted,
    className,
    htmlFor,
    slots: _slots,
    stylesheet,
    key: _,
    ...attributes
  } = attrs
  if (typeof tag === 'function') {
    return tag(attrs)
  }
  const children = _children && Array.isArray(_children)
    ? _children
    : _children
    ? [_children]
    : []
  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error('Script tag not allowed unless \'trusted\' property set')
  }

  /** Now to determine what our root element is */
  const root = tag.toLowerCase()

  const rootAttrs: string[] = []

  /** if we have dataTrigger attribute wire up formatted correctly*/

  /** if we have className add it to Element */
  className && rootAttrs.push(`class="${className}"`)
  /** if we have htmlFor add it to Element */
  htmlFor && rootAttrs.push(`for="${htmlFor}"`)

  /** next we want to loops through our attributes */
  for (const key in attributes) {
    /** all events our delegated via the data-trigger attribute so we want
     * throw on attempts to provide `on` attributes
     */
    if (key.startsWith('on')) {
      throw new Error(`Event handler attributes are not allowed:  [${key}]`)
    }
    if (!primitives.has(trueTypeOf(attributes[key]))) {
      throw new Error(
        `Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`,
      )
    }
    /** grab the value from the attribute */
    const value: Primitive | Children = attributes[key]
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
    return {
      content: `<${[root, ...rootAttrs].join(' ')}/>`,
    }
  }

  /** create a array to hold root children  */
  const rootChildren: string[] = []

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
    /** We destructured out the stylesheet attribute as it's only for
     * custom elements declarative shadow dom  we create the style node
     * append the stylesheet as the first child of the declarative shadowDom template */
    if (stylesheet) {
      templateChildren.push(
        joinParts(
          'style',
          undefined,
          [stylesheet],
        ),
      )
    }
    /** We generally want to delegate focus to the first focusable element in
     * custom elements
     */
    templateAttrs.push(
      `shadowrootdelegatesfocus="${shadowRootDelegatesFocus}"`,
    )
    /** now that we've configured our declarative shadowDom we need to add slots elements to the rootChildren array **/

    const slots = _slots && Array.isArray(_slots)
      ? _slots
      : _slots
      ? [_slots]
      : []
    const length = slots.length
    for (let i = 0; i < length; i++) {
      const child = slots[i]
      /** P1 string child*/
      if (typeof child === 'string') {
        rootChildren.push(trusted ? child : escape(child))
        continue
      }
      /** P2 child is a Template object */
      rootChildren.push(child.content)
    }
  }

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
    /** P3 custom element and template object*/
    if (isCustomElement) {
      templateChildren.push(child.content)
      continue
    }
    /**  P4 default use root tag*/
    rootChildren.push(child.content)
  }
  isCustomElement && rootChildren.unshift(joinParts(
    'template',
    templateAttrs,
    templateChildren,
  ))
  return {
    content: joinParts(root, rootAttrs, rootChildren),
  }
}

export { createTemplate as h }

export function Fragment({ children }: Attrs) {
  children = children && Array.isArray(children)
    ? children
    : children
    ? [children]
    : []

  return {
    content: children.map((child) =>
      typeof child === 'string' ? child : child.content
    ).join(' '),
  }
}
