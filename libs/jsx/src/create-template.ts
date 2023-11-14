import { escape, kebabCase } from '@plaited/utils'
import {
  booleanAttrs,
  primitives,
  voidTags,
  validPrimitiveChildren,
  dataTrigger as dataTriggerKey,
  templateKeys
} from './constants.js'
import { Attrs, CreateTemplate, Template } from './types.js'
import { memo } from './memo.js'

/** create server element string representation */
const joinParts = (tag: string, attrs: string[] = [], children: string[]) =>
  `<${[tag, ...attrs].join(' ')}>${children.join('')}</${tag}>`

const ensureArray = <T>(obj?: T | T[]) => (Array.isArray(obj) ? obj : obj ? [obj] : [])

const length = templateKeys.length

const isTemplateObject = (obj: Record<string, unknown>): obj is Template =>{
  for(let i = 0; i < length; i++) {
    if(!Object.hasOwn(obj, templateKeys[i])) return false
  }
  return true
}

const isTemplateElement = (el: Element): el is HTMLTemplateElement => el.tagName === 'TEMPLATE'
/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = memo((_tag, attrs) => {
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

  /** Create our element and array to hold attributes */
  const content = document.createElement(tag)
  const attributesArray: string[] = []

  /** handle JS reserved words commonly used in html class & for*/
  if(htmlFor) {
    content.setAttribute('for', htmlFor)
    attributesArray.push(`for="${htmlFor}"`)
  }
  if(className) {
    attributesArray.push(`class="${className}"`)
    content.className = className
  }
  /** if we have dataTrigger attribute wire up formatted correctly*/
  if (dataTrigger) {
    const value = Object.entries(dataTrigger)
      .map<string>(([ev, req]) => `${ev}->${req}`)
      .join(' ')
    attributesArray.push(`${dataTriggerKey}="${value}"`)
    content.dataset.trigger = value
  }
  /** if we have style add it to element */
  if (style) {
    const value = escape(Object.entries(style)
      /** convert camelCase style prop into dash-case ones */
      .map<string>(([prop, val]) => `${prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${val};`)
      .join(' '))
    attributesArray.push(`style="${value}"`)
    content.style.cssText = value
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
    const value = attributes[key]

    /** P2 typeof attribute is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof value)) {
      throw new Error(`Attributes not declared in BaseAttrs must be of type Primitive: ${key} is not primitive`)
    }
    /** test for and handle boolean attributes */
    if (booleanAttrs.has(key)) {
      attributesArray.push(key)
      content.toggleAttribute(key, true)
      continue
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    const kebabKey = kebabCase(key)
    const safeValue = trusted ? `${formattedValue}` : escape(`${formattedValue}`)
    attributesArray.push(`${kebabKey}="${safeValue}"`)
    content.setAttribute(kebabKey, safeValue)
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(tag)) {
    return {
      stylesheets,
      content,
      string: `<${[tag, ...attributesArray].join(' ')}/>`
    }
  }
  const childrenArray: string[] = []
  /** Test if the the tag is a template and if it's a declarative shadow dom template */
  const template = isTemplateElement(content)
  const isDeclarativeShadowDOM = template && content.hasAttribute('shadowrootmode')
  /** time to append the children to our template if we have em*/
  const length = children.length
  const element = template ? content.content : content
  for (let i = 0; i < length; i++) {
    const child = children[i]
    /** P1 child IS {@type Template}*/

    if (typeof child === 'object' && isTemplateObject(child)) {
      element.append(child.content)
      childrenArray.push(child.string)
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
    childrenArray.push(str)
    element.append(str)
  }
  if (isDeclarativeShadowDOM) {
     /** We destructured out the stylesheet attribute as it's only for
     * custom elements declarative shadow dom  we create the style node
     * append the stylesheet as the first child of the declarative shadowDom template */
     if (stylesheets.size) {
      childrenArray.unshift(joinParts('style', undefined, [...stylesheets]))
    }
    stylesheets.clear()
  }
  /** If it is a declarative shadow DOM we want to rip out the content and simply append an empty fragment */
  isDeclarativeShadowDOM && content.content.replaceChildren()
  return {
    stylesheets,
    content: isDeclarativeShadowDOM ? content.content : content,
    string: joinParts(tag, attributesArray, childrenArray),
  }
})

export { createTemplate as h }


export const  Fragment = ({ children: _children }: Attrs) =>{
  const children = ensureArray(_children)
  const stylesheets = new Set<string>()
  const length = children.length
  const template = document.createElement('template')
  const string = []
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (typeof child === 'string') {
      string.push(child)
      template.content.append(child)
      continue
    }
    string.push(child.string)
    template.content.append(child.content)
    for (const sheet of child.stylesheets) {
      !stylesheets.has(sheet) && stylesheets.add(sheet)
    }
  }
  return {
    content: template.content,
    string: string.join(''),
    stylesheets,
  }
}