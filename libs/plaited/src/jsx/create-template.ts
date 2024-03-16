import { escape, kebabCase, isTypeOf } from '@plaited/utils'
import { booleanAttrs, primitives, voidTags, validPrimitiveChildren, bpTrigger as bpTriggerKey } from './constants.js'
import {
  Attrs,
  BooleanAttributes,
  CreateTemplate,
  PlaitedElementConstructor,
  TemplateObject,
  VoidTags,
} from '../types.js'

const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj.flat() : [obj])

/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = (_tag, attrs) => {
  const {
    children: _children,
    trusted,
    stylesheet,
    style,
    'bp-trigger': bpTrigger,
    className,
    htmlFor,
    ...attributes
  } = attrs
  const registry = new Set<PlaitedElementConstructor>()
  if (typeof _tag === 'function') {
    return _tag(attrs)
  }
  const tag = _tag.toLowerCase().trim()
  const stylesheets = new Set<string>()
  stylesheet &&
    (ensureArray(stylesheet).filter(Boolean) as string[]).forEach(
      (s: string) => !stylesheets.has(s) && stylesheets.add(s),
    )
  const children = ensureArray(_children)
  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error("Script tag not allowed unless 'trusted' property set")
  }

  /** Now to create an array to store our node attributes */
  const start = [`<${tag} `]
  /** handle JS reserved words commonly used in html class & for*/
  if (htmlFor) start.push(`for="${htmlFor}" `)
  if (className) start.push(`class="${Array.isArray(className) ? className.filter(Boolean).join(' ') : className}" `)
  /** if we have bpTrigger attribute wire up formatted correctly*/
  if (bpTrigger) {
    const value = Object.entries(bpTrigger)
      .map<string>(([ev, req]) => `${ev}:${req}`)
      .join(' ')
    start.push(`${bpTriggerKey}="${value}" `)
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones so long as not cssVar */
      .map<string>(([prop, val]) => `${prop.startsWith('--') ? prop : kebabCase(prop)}:${val};`)
      .join(' ')
    start.push(`style="${escape(value)}" `)
  }
  /** next we want to loops through our attributes */
  for (const key in attributes) {
    /** P1 all events are delegated via the bp-trigger attribute so we want
     * skip on attempts to provide `on` attributes
     */
    if (key.startsWith('on')) {
      console.log(key)
      throw new Error(`Event handler attributes are not allowed:  [${key}]`)
    }
    /** test for and handle boolean attributes */
    if (booleanAttrs.has(key as BooleanAttributes)) {
      start.push(`${key} `)
      continue
    }
    /** Grab the value from the attribute */
    const value = attributes[key]
    /** P2 typeof attribute is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof value)) {
      throw new Error(`Attributes not declared in PlaitedAttributes must be of type Primitive: ${key} is not primitive`)
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    start.push(`${key}="${trusted ? `${formattedValue}" ` : escape(`${formattedValue}`)}" `)
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(tag as keyof VoidTags)) {
    start.push('/>')
    return {
      client: start,
      server: start,
      stylesheets,
      registry,
      $: '🦄',
    }
  }
  start.push('>')
  const clientEnd: string[] = []
  /** Test if the the tag is a template and if it's a declarative shadow dom template */
  const isDeclarativeShadowDOM = tag === 'template' && Object.hasOwn(attrs, 'shadowrootmode')
  /** time to append the children to our template if we have em*/
  const length = children.length
  const serverEnd: string[] = []
  for (let i = 0; i < length; i++) {
    const child = children[i]
    /** P1 child IS {@type Template}*/
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === '🦄') {
      clientEnd.push(...child.client)
      serverEnd.push(...child.server)
      for (const sheet of child.stylesheets) stylesheets.add(sheet)
      for (const component of child.registry) registry.add(component)
      continue
    }
    /** P2 typeof child is NOT a valid primitive child then skip and do nothing */
    if (!validPrimitiveChildren.has(typeof child)) continue
    /** P3 child IS {@type Primitive} */
    const str = trusted ? `${child}` : escape(`${child}`)
    clientEnd.push(str)
    serverEnd.push(str)
  }
  if (isDeclarativeShadowDOM) {
    /** We continue to hoist our stylesheet until we run
     * into a declarative shadow dom then we push the
     * stylesheet as the first child of the declarative
     * shadowDom template array  and clear the stylesheets set
     */
    if (stylesheets.size) {
      start.push(`<style>${Array.from(stylesheets).join('')}</style>`)
      stylesheets.clear()
    }
  }
  clientEnd.push(`</${tag}>`)
  serverEnd.push(`</${tag}>`)
  return {
    client: isDeclarativeShadowDOM ? [] : [...start, ...clientEnd],
    server: [...start, ...serverEnd],
    stylesheets,
    registry,
    $: '🦄',
  }
}

export { createTemplate as h }

export const Fragment = ({ children: _children }: Attrs): TemplateObject => {
  const children = ensureArray(_children)
  const client: string[] = []
  const server: string[] = []
  const stylesheets = new Set<string>()
  const registry = new Set<PlaitedElementConstructor>()
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === '🦄') {
      client.push(...child.client)
      server.push(...child.server)
      for (const sheet of child.stylesheets) stylesheets.add(sheet)
      for (const component of child.registry) registry.add(component)
    }
    if (!validPrimitiveChildren.has(typeof child)) continue
    const safeChild = escape(`${child}`)
    client.push(safeChild)
    server.push(safeChild)
  }
  return {
    client,
    stylesheets,
    server,
    registry,
    $: '🦄',
  }
}
