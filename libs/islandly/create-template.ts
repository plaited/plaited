// deno-lint-ignore-file no-explicit-any
import { canUseDOM, escape } from '../utils/mod.ts'
import { Primitive } from './types.ts'
import { booleanAttrs, dataTrigger, primitives, voidTags } from './constants.ts'

export type ServerTemplate = {
  content: string
  stylesheets: Set<string>
}

type ServerChildren = (string | ServerTemplate)[] | (string | ServerTemplate)

export type PlaitedTemplate<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> = (attrs: ServerAttrs<T>) => ServerTemplate

export type Template = {
  content: HTMLElement | SVGElement
  stylesheets: Set<string>
}

type Children = (string | Template)[] | (string | Template)

export type PlaitedElement<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> = (attrs: Attrs<T>) => Template

export type BaseAttrs = {
  class?: string
  'data-target'?: string | number
  'data-trigger'?: Record<string, string>
  for?: string
  key?: string
  shadowrootmode?: 'open' | 'closed'
  shadowrootdelegatesfocus?: boolean
  stylesheet?: string
  /** setting trusted to true will disable all escaping security policy measures for this element template */
  trusted?: boolean
  style?: Record<string, string>
}

type ServerAttrs<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> =
  & {
    children?: ServerChildren
    slots?: ServerChildren
  }
  & BaseAttrs
  & T

type Attrs<
  T extends Record<string, any> = Record<
    string,
    any
  >,
> =
  & {
    children?: Children
    slots?: Children
  }
  & BaseAttrs
  & T
type ServerTag = string | `${string}-${string}` | PlaitedTemplate
interface CreateServer {
  <T extends Record<string, any>>(
    tag: ServerTag,
    attrs: ServerAttrs<T>,
  ): ServerTemplate
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
export const createServer: CreateServer = (tag, attrs) => {
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
    ? [_children]
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
    const value = Object.entries(trigger).map<string>(([ev, req]) =>
      `${ev}->${req}`
    )
      .join(' ')
    rootAttrs.push(`${dataTrigger}="${value}"`)
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones */
      .map<string>(([prop, val]) =>
        `${prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${val};`
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
        `Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`,
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
      `${key}="${trusted ? `${formattedValue}` : escape(`${formattedValue}`)}"`,
    )
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(root)) {
    return {
      stylesheets,
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
    templateAttrs.push(`shadowrootmode="${shadowrootmode}"`)
    /** We destructured out the stylesheet attribute as it's only for
     * custom elements declarative shadow dom  we create the style node
     * append the stylesheet as the first child of the declarative shadowDom template */
    if (stylesheets.size) {
      templateChildren.push(
        joinParts(
          'style',
          undefined,
          [...stylesheets],
        ),
      )
    }
    /** We generally want to delegate focus to the first focusable element in
     * custom elements
     */
    templateAttrs.push(
      `shadowrootdelegatesfocus="${shadowrootdelegatesfocus}"`,
    )
    /** Now that we've configured our declarative shadowDom we need to add slots elements to the rootChildren array **/
    const slots = !_slots ? [] : Array.isArray(_slots) ? _slots : [_slots]
    const length = slots.length
    for (let i = 0; i < length; i++) {
      const child = slots[i]
      /** P1 child IS {@type Template} */
      if (typeof child === 'object' && 'content' in child) {
        rootChildren.push(child.content)
        continue
      }
      /** P2 typeof child is NOT {@type Primitive} then skip and do nothing */
      if (!primitives.has(typeof child)) continue
      /** P3 child IS {@type Template} */
      const formattedChild = child ?? ''
      rootChildren.push(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`),
      )
    }
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
        trusted ? `${formattedChild}` : escape(`${formattedChild}`),
      )
      continue
    }
    /** P5 child IS {@type Primitive} */
    rootChildren.push(
      trusted ? `${formattedChild}` : escape(`${formattedChild}`),
    )
  }
  /** append declarative shadow dom to beginning of rootChildren array and clear stylesheet set so it's not passed along*/
  if (isCustomElement) {
    stylesheets.clear()
    rootChildren.unshift(joinParts(
      'template',
      templateAttrs,
      templateChildren,
    ))
  }
  return {
    stylesheets,
    content: joinParts(root, rootAttrs, rootChildren),
  }
}

type Tag = string | `${string}-${string}` | PlaitedElement
interface CreateClient {
  <T extends Record<string, any>>(
    tag: Tag,
    attrs: Attrs<T>,
  ): Template
}
export const createClient: CreateClient = (tag, attrs) => {
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
    ? [_children]
    : []
  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error('Script tag not allowed unless \'trusted\' property set')
  }

  /** Now to determine what our root element is */
  const root = document.createElement(tag)

  /** if we have dataTrigger attribute wire up formatted correctly*/
  if (trigger) {
    const value = Object.entries(trigger).map<string>(([ev, req]) =>
      `${ev}->${req}`
    )
      .join(' ')
    root.setAttribute(dataTrigger, value)
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones */
      .map<string>(([prop, val]) =>
        `${prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${val};`
      )
      .join(' ')
    root.setAttribute('style', escape(value))
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
        `Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`,
      )
    }
    /** test for and handle boolean attributes */
    if (booleanAttrs.has(key)) {
      root.setAttribute(key, '')
      continue
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    root.setAttribute(
      key,
      trusted ? `${formattedValue}` : escape(`${formattedValue}`),
    )
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(tag)) {
    return {
      stylesheets,
      content: root,
    }
  }

  /** Test if the the tag is a string and if it's a custom element */
  const isCustomElement = customElementRegex.test(tag)

  /** If our template is for a custom element we're going to create a
   * declarative shadow dom
   */
  const template = document.createElement('template')
  if (isCustomElement) {
    root.appendChild(template)
    /** Set the mode of the shadowDom */
    template.setAttribute('shadowrootmode', shadowrootmode)
    /** We generally want to delegate focus to the first focusable element in
     * custom elements
     */
    template.setAttribute(
      'shadowrootdelegatesfocus',
      `${shadowrootdelegatesfocus}`,
    )
    /** Now that we've configured our declarative shadowDom we need to add slots elements to the rootChildren array **/
    const slots = !_slots ? [] : Array.isArray(_slots) ? _slots : [_slots]
    const length = slots.length
    for (let i = 0; i < length; i++) {
      const child = slots[i]
      /** P1 child IS {@type Template} */
      if (typeof child === 'object' && 'content' in child) {
        root.appendChild(child.content)
        continue
      }
      /** P2 typeof child is NOT {@type Primitive} then skip and do nothing */
      if (!primitives.has(typeof child)) continue
      /** P3 child IS {@type Template} */
      const formattedChild = child ?? ''
      root.append(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`),
      )
    }
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
      template.appendChild(child.content)
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
      root.appendChild(child.content)
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
      template.append(
        trusted ? `${formattedChild}` : escape(`${formattedChild}`),
      )
      continue
    }
    /** P5 child IS {@type Primitive} */
    root.append(
      trusted ? `${formattedChild}` : escape(`${formattedChild}`),
    )
  }
  /** append stylesheets to template and clear stylesheet set so it's not passed along*/
  if (isCustomElement) {
    /** We destructured out the stylesheet attribute as it's only for
     * custom elements declarative shadow dom  we create the style node
     * append the stylesheet as the first child of the declarative shadowDom template */
    if (stylesheets.size) {
      const s = document.createElement('style')
      s.innerHTML = [...stylesheets].join('')
      template.appendChild(s)
    }
    stylesheets.clear()
  }
  return {
    stylesheets,
    content: root,
  }
}

function createTemplate<T extends Record<string, any>>(
  tag: Tag,
  attrs: Attrs<T>,
): Template
function createTemplate<T extends Record<string, any>>(
  tag: ServerTag,
  attrs: ServerAttrs<T>,
): ServerTemplate
function createTemplate<T extends Record<string, any>>(
  tag: Tag | ServerTag,
  attrs: Attrs<T> | ServerAttrs<T>,
) {
  return canUseDOM()
    ? createClient(tag as Tag, attrs)
    : createServer(tag as ServerTag, attrs)
}

export { createTemplate, createTemplate as h }

export function Fragment({ children }: Attrs) {
  children = children && Array.isArray(children)
    ? children
    : children
    ? [children]
    : []

  return {
    content: children.map((child) =>
      typeof child === 'string' ? child : child.content
    ).join(''),
  }
}
