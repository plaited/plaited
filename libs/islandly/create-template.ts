// deno-lint-ignore-file no-explicit-any
import { escape, trueTypeOf } from '../utils/mod.ts'
import { Primitive } from './types.ts'
import {
  booleanAttrs,
  dataTrigger as _dataTrigger,
  primitives,
  voidTags,
} from './constants.ts'

export type Template = {
  template: string
  slot: boolean
}

export type PlaitedElement<
  T extends Record<string, any> = Record<string, any>,
> = (attrs: Attrs<T>) => Template

type Children = (string | Template)[] | (string | Template)

export type BaseAttrs = {
  class?: never
  className?: string
  children?: Children
  dataTarget?: string
  dataTrigger?: Record<string, string>
  for?: never
  htmlFor?: string
  key?: string
  shadowRootMode?: 'open' | 'closed'
  shadowRootDelegatesFocus?: boolean
  slot?: string
  styles?: string | Set<string>
  /** setting trusted to true will disable all escaping security policy measures for this node template */
  trusted?: boolean
  style?: Record<string, string>
}

export type Attrs<T extends Record<string, any> = Record<string, any>> =
  & BaseAttrs
  & T

export type Tag =
  | string
  | `${string}-${string}`
  | PlaitedElement

interface CreateTemplate {
  <T extends Record<string, any>>(
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
) => `<${[tag, ...attrs].join(' ')}>${children.join(' ')}</${tag}>`

/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = (tag, attrs) => {
  const {
    shadowRootMode = 'open',
    children: _children,
    shadowRootDelegatesFocus = true,
    trusted,
    styles,
    dataTrigger,
    className,
    htmlFor,
    style,
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
      throw new Error(`Event handler attributes are not allowed:  [${key}]`)
    }
    if (!primitives.has(trueTypeOf(attributes[key]))) {
      throw new Error(
        `Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`,
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
    return {
      slot: !!attributes.slot,
      template: `<${[root, ...rootAttrs].join(' ')}/>`,
    }
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
        joinParts(
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
      rootChildren.push(child.template)
      continue
    }
    /** P4 ServerElement and custom element */
    if (isCustomElement) {
      templateChildren.push(child.template)
      continue
    }
    /**  P5 default use root tag*/
    rootChildren.push(child.template)
  }
  isCustomElement && rootChildren.unshift(joinParts(
    'template',
    templateAttrs,
    templateChildren,
  ))
  return {
    slot: !!attributes.slot,
    template: joinParts(root, rootAttrs, rootChildren),
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
    template: children.map((child) =>
      typeof child === 'string' ? child : child.template
    ).join(' '),
    slot: children.some((child) => typeof child === 'object' && child.slot),
  }
}
