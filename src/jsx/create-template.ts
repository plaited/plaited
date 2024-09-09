import type { Attrs, DetailedHTMLAttributes, TemplateObject, ElementAttributeList, CustomElementTag, FunctionTemplate } from './jsx.types.js'
import { isTypeOf, kebabCase, escape } from '../utils.js'
import { BOOLEAN_ATTRS, PRIMITIVES, VOID_TAGS, VALID_PRIMITIVE_CHILDREN, P_TRIGGER } from './constants.js'
import { TEMPLATE_OBJECT_IDENTIFIER } from '../shared/constants.js'

type Tag = string | CustomElementTag | FunctionTemplate

type InferAttrs<T extends Tag> =
  T extends keyof ElementAttributeList ? ElementAttributeList[T]
  : T extends FunctionTemplate ? Parameters<T>[0]
  : T extends CustomElementTag ? DetailedHTMLAttributes
  : Attrs

type CreateTemplate = <T extends Tag>(tag: T, attrs: InferAttrs<T>) => TemplateObject

/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = (_tag, attrs) => {
  const {
    children: _children,
    trusted,
    stylesheet,
    style,
    'p-trigger': bpTrigger,
    className,
    htmlFor,
    ...attributes
  } = attrs
  const registry: string[] = []
  if (typeof _tag === 'function') {
    return _tag(attrs)
  }
  const tag = _tag.toLowerCase().trim()

  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error("Script tag not allowed unless 'trusted' property set")
  }
  const isDeclarativeShadowDom = tag === 'template' && Object.hasOwn(attrs, 'shadowrootmode')
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
    start.push(`${P_TRIGGER}="${value}" `)
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
    /** P1 all events are delegated via the p-trigger attribute so we want
     * skip on attempts to provide `on` attributes
     */
    if (key.startsWith('on')) {
      console.log(key)
      throw new Error(`Event handler attributes are not allowed:  [${key}]`)
    }
    /** Grab the value from the attribute */
    const value = attributes[key]
    /** test for and handle boolean attributes */
    if (BOOLEAN_ATTRS.has(key)) {
      value && start.push(`${key} `)
      continue
    }
    /** P2 typeof attribute is NOT {@type Primitive} then skip and do nothing */
    if (!PRIMITIVES.has(typeof value)) {
      throw new Error(`Attributes not declared in PlaitedAttributes must be of type Primitive: ${key} is not primitive`)
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    start.push(`${key}="${trusted ? `${formattedValue}" ` : escape(`${formattedValue}`)}" `)
  }
  /** Create are stylesheet set */
  let stylesheets =
    stylesheet ? [...(Array.isArray(stylesheet) ? (stylesheet.filter(Boolean) as string[]) : [stylesheet])] : []

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (VOID_TAGS.has(tag)) {
    start.push('/>')
    return {
      html: start,
      stylesheets,
      registry,
      $: TEMPLATE_OBJECT_IDENTIFIER,
    }
  }
  start.push('>')
  const end: string[] = []
  /** Ensure children is an array */
  const children = Array.isArray(_children) ? _children.flat() : [_children]
  /** time to append the children to our template if we have em*/
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    /** P1 child IS {@type Template}*/
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      end.push(...child.html)
      stylesheets.push(...child.stylesheets)
      registry.push(...child.registry)
      continue
    }
    /** P2 typeof child is NOT a valid primitive child then skip and do nothing */
    if (!VALID_PRIMITIVE_CHILDREN.has(typeof child)) continue
    /** P3 child IS {@type Primitive} */
    const str = trusted ? `${child}` : escape(`${child}`)
    end.push(str)
  }
  end.push(`</${tag}>`)
  /** Test if the the tag is a template and if it's a declarative shadow dom */
  if (isDeclarativeShadowDom) {
    /** We continue to hoist our stylesheet until we run
     * into a declarative shadow dom then we push the
     * stylesheet as the first child of the declarative
     * shadowDom template array  and clear the stylesheets set
     */
    if (stylesheets.length) {
      start.push(`<style>${Array.from(new Set(stylesheets)).join('')}</style>`)
      stylesheets = []
    }
  }
  return {
    html: [...start, ...end],
    stylesheets,
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}

export { createTemplate as h }

export const Fragment = ({ children: _children }: Attrs): TemplateObject => {
  const children = Array.isArray(_children) ? _children.flat() : [_children]
  const html: string[] = []
  const stylesheets: string[] = []
  const registry: string[] = []
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      html.push(...child.html)
      stylesheets.push(...child.stylesheets)
      registry.push(...child.registry)
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(typeof child)) continue
    const safeChild = escape(`${child}`)
    html.push(safeChild)
  }
  return {
    html,
    stylesheets,
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}
