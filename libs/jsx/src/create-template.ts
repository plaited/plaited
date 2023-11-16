import { escape, kebabCase } from '@plaited/utils'
import { booleanAttrs, primitives, voidTags, validPrimitiveChildren, dataTrigger as dataTriggerKey } from './constants.js'
import { Attrs, CreateTemplate } from './types.js'

/** create server element string representation */
const ensureArray = <T>(obj: T | T[] = []) => (!Array.isArray(obj) ?  [obj] : obj)

/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = (_tag, attrs) => {
  const {
    children: _children,
    trusted,
    stylesheet,
    style,
    key: _,
    'data-trigger': trigger,
    dataTrigger = trigger,
    className,
    htmlFor,
    ...attributes
  } = attrs
  if (typeof _tag === 'function') {
    return _tag(attrs)
  }
  const tag = _tag.toLowerCase().trim()
  const stylesheets = new Set<string>()
  stylesheet && ensureArray(stylesheet).forEach((s) => !stylesheets.has(s) && stylesheets.add(s))
  const children = ensureArray(_children)
  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error("Script tag not allowed unless 'trusted' property set")
  }

  /** Now to create an array to store our node attributes */
  let start = `<${tag} `
  /** handle JS reserved words commonly used in html class & for*/
  if(htmlFor) start += `for="${htmlFor}" `
  if(className) start += `class="${className}" `
  /** if we have dataTrigger attribute wire up formatted correctly*/
  if (dataTrigger) {
    const value = Object.entries(dataTrigger)
      .map<string>(([ev, req]) => `${ev}->${req}`)
      .join(' ')
      start += `${dataTriggerKey}="${value}" `
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones so long as not cssVar */
      .map<string>(([prop, val]) => `${prop.startsWith('--') ? prop : kebabCase(prop)}:${val};`)
      .join(' ')
      start+= `style="${escape(value)}" `
  }
  /** next we want to loops through our attributes */
  for (const key in attributes) {
    /** P1 all events are delegated via the data-trigger attribute so we want
     * throw on attempts to provide `on` attributes
     */
    if (key.startsWith('on')) {
      throw new Error(`Event handler attributes are not allowed:  [${key}]`)
    }
    /** test for and handle boolean attributes */
    if (booleanAttrs.has(key)) {
      start+= `${key} `
      continue
    }
    /** Grab the value from the attribute */
    const value = attributes[key]
    /** P2 typeof attribute is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof value)) {
      throw new Error(`Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`)
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    start+= `${kebabCase(key)}="${trusted
      ? `${formattedValue}" `
      : escape(`${formattedValue}`)}" `
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(tag)) {
    start+= '/>'
    return {
      content: start,
      string: start,
      stylesheets,
    }
  }
  start+= '>'
  let end = ''
  /** Test if the the tag is a template and if it's a declarative shadow dom template */
  const isDeclarativeShadowDOM = tag === 'template' && Object.hasOwn(attrs, 'shadowrootmode')
  /** time to append the children to our template if we have em*/
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    /** P1 child IS {@type Template}*/
    if (typeof child === 'object' && 'content' in child && 'stylesheets' in child) {
      end+= child.content
      for (const sheet of child.stylesheets) {
        !stylesheets.has(sheet) && stylesheets.add(sheet)
      }
      continue
    }
    /** P2 typeof child is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof child)) continue
    const formattedChild = validPrimitiveChildren.has(typeof child) ? child : ''
    /** P3 child IS {@type Primitive} */
    const str = trusted ? `${formattedChild}`.trim() : escape(`${formattedChild}`).trim()
    end+= str
  }
  if (isDeclarativeShadowDOM) {
    /** We continue to hoist our stylesheet until we run
     * into a declarative shadow dom then we push the
     * stylesheet as the first child of the declarative
     * shadowDom template array  and clear the stylesheets set
     */
    if (stylesheets.size) {
      start+= `<style>${Array.from(stylesheets).join('')}</style>`
      stylesheets.clear()
    }
  }
  end+= `</${tag}>`
  const content = start + end
  return {
    content: isDeclarativeShadowDOM ? '' : content,
    string: content,
    stylesheets,
  }
}

export { createTemplate as h }

export const Fragment = ({ children: _children }: Attrs) => {
  const children = ensureArray(_children)
  let content = ''
  let string = ''
  const stylesheets = new Set<string>()
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (typeof child === 'string') {
      const safeChild = escape(child)
      content += safeChild
      string += safeChild
      continue
    }
    content += child.content
    string += child.string
    for (const sheet of child.stylesheets) {
      !stylesheets.has(sheet) && stylesheets.add(sheet)
    }
  }
  return {
    content,
    stylesheets,
    string
  }
}
