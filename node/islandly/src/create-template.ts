import { escape } from '@plaited/utils'
import { Primitive } from './types.js'
import { booleanAttrs, dataTrigger, primitives, voidTags } from './constants.js'

export type Template = {
  content: string
  stylesheets: Set<string>
}

type Children = (string | Template)[] | (string | Template)

export type BaseAttrs = {
  class?: string
  children?: Children
  'data-target'?: string | number
  'data-trigger'?: Record<string, string>
  for?: string
  key?: string
  shadowrootmode?: 'open' | 'closed'
  shadowrootdelegatesfocus?: boolean
  stylesheet?: string
  /** setting trusted to true will disable all escaping security policy measures for this element template */
  trusted?: boolean
  slots?: Children
  style?: Record<string, string>
}

export type Attrs<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> =
  & BaseAttrs
  & T

export type PlaitedElement<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> = (attrs: Attrs<T>) => Template



type Tag = string | `${string}-${string}` | PlaitedElement

export interface CreateTemplate {
  <T extends Record<string, any>>(
    tag: Tag,
    attrs: Attrs<T>,
  ): Template
}

/** custom element tagName regex */
const customElementRegex = /^[a-z]+-[a-z]+(?:-[a-z]+)*$/

/** create server element string representation */
const joinParts = (
  tag: string,
  attrs: string[] = [],
  children: string[]
) => `<${[ tag, ...attrs ].join(' ')}>${children.join('')}</${tag}>`

/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = (tag, attrs) => {
  const {
    shadowrootmode = 'open',
    children: _children,
    shadowrootdelegatesfocus = true,
    trusted,
    slots: _slots,
    stylesheet,
    style,
    key: _,
    'data-trigger': trigger,
    ...attributes
  } = attrs
  if (typeof tag === 'function') {
    return tag(attrs)
  }
  const stylesheets = new Set<string>()
  stylesheet && stylesheets.add(stylesheet)
  const children = _children && Array.isArray(_children)
    ? _children
    : _children
    ? [ _children ]
    : []
  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error('Script tag not allowed unless \'trusted\' property set')
  }

  /** Now to determine what our root element is */
  const root = tag.toLowerCase()
  /** create a list to hold  our root attributes*/
  const rootAttrs: string[] = []
  /** if we have dataTrigger attribute wire up formatted correctly*/
  if (trigger) {
    const value = Object.entries(trigger).map<string>(([ ev, req ]) =>
      `${ev}->${req}`
    )
      .join(' ')
    rootAttrs.push(`${dataTrigger}="${value}"`)
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones */
      .map<string>(([ prop, val ]) =>
        `${prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${val};`
      )
      .join(' ')
    rootAttrs.push(`style="${escape(value)}"`)
  }
  /** next we want to loops through our attributes */
  for (const key in attributes) {
    /** P1 all events are delegated via the data-trigger attribute so we want
     * throw on attempts to provide `on` attributes
     */
    if (key.startsWith('on')) {
      throw new Error(`Event handler attributes are not allowed:  [${key}]`)
    }
    /** Grab the value from the attribute */
    const value: Primitive | Children = attributes[key]

    /** P2 typeof attribute is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof value)) {
      throw new Error(
        `Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`
      )
    }
    /** test for and handle boolean attributes */
    if (booleanAttrs.has(key)) {
      rootAttrs.push(`${key}`)
      continue
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    rootAttrs.push(
      `${key}="${trusted ? `${formattedValue}` : escape(`${formattedValue}`)}"`
    )
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(root)) {
    return {
      stylesheets,
      content: `<${[ root, ...rootAttrs ].join(' ')}/>`,
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
    templateAttrs.push(`shadowrootmode="${shadowrootmode}"`)
    /** We generally want to delegate focus to the first focusable element in
     * custom elements
     */
    templateAttrs.push(
      `shadowrootdelegatesfocus="${shadowrootdelegatesfocus}"`
    )
  }
  /** time to append the children to our template if we have em*/
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    /** P1 element is a customElement and child IS {@type Template}*/
    if (
      isCustomElement &&
      typeof child === 'object' &&
      'content' in child
    ) {
      templateChildren.push(child.content)
      for (const sheet of child.stylesheets) {
        stylesheets.add(sheet)
      }
      continue
    }
    /** P2 child IS {@type Template}*/
    if (
      typeof child === 'object' &&
      'content' in child
    ) {
      rootChildren.push(child.content)
      for (const sheet of child.stylesheets) {
        stylesheets.add(sheet)
      }
      continue
    }
    /** P3 typeof child is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof child)) continue
    const formattedChild = child ?? ''
    /** P4 element is a customElement and child IS {@type Primitive} */
    if (isCustomElement) {
      templateChildren.push(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`)
      )
      continue
    }
    /** P5 child IS {@type Primitive} */
    rootChildren.push(
      trusted ? `${formattedChild}` : escape(`${formattedChild}`)
    )
  }
  if (isCustomElement) {
    /** We destructured out the stylesheet attribute as it's only for
     * custom elements declarative shadow dom  we create the style node
     * append the stylesheet as the first child of the declarative shadowDom template */
    if (stylesheets.size) {
      templateChildren.unshift(
        joinParts(
          'style',
          undefined,
          [ ...stylesheets ]
        )
      )
    }
    /** append declarative shadow dom to beginning of rootChildren
     * array and clear stylesheet set so shadow dom children styles are not not passed along
     */
    rootChildren.unshift(joinParts(
      'template',
      templateAttrs,
      templateChildren
    ))
    stylesheets.clear()

    /** We need to append our slots outside the template and carry stylesheets forward **/
    const slots = !_slots ? [] : Array.isArray(_slots) ? _slots : [ _slots ]
    const length = slots.length
    for (let i = 0; i < length; i++) {
      const child = slots[i]
      /** P1 child IS {@type Template} */
      if (typeof child === 'object' && 'content' in child) {
        rootChildren.push(child.content)
        for (const sheet of child.stylesheets) {
          stylesheets.add(sheet)
        }
        continue
      }
      /** P2 typeof child is NOT {@type Primitive} then skip and do nothing */
      if (!primitives.has(typeof child)) continue
      /** P3 child IS {@type Template} */
      const formattedChild = child ?? ''
      rootChildren.push(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`)
      )
    }
  }
  return {
    stylesheets,
    content: joinParts(root, rootAttrs, rootChildren),
  }
}

export { createTemplate as h }

export function Fragment({ children }: Attrs) {
  children = children && Array.isArray(children)
    ? children
    : children
    ? [ children ]
    : []
  let content = ''
  const stylesheets = new Set<string>()
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (typeof child === 'string') {
      content += child
      continue
    }
    content += child.content
    for (const sheet of child.stylesheets) {
      stylesheets.add(sheet)
    }
  }
  return {
    content,
    stylesheets,
  }
}
