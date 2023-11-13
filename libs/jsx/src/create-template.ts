import { escape, kebabCase } from '@plaited/utils'
import {
  booleanAttrs,
  primitives,
  voidTags,
  validPrimitiveChildren,
  customElementRegex,
} from './constants.js'
import { Attrs, CreateTemplate } from './types.js'
import { memo } from './memo.js'

const removeClosingTag = (str: string, closingTag:string) => str.slice(0, -closingTag.length);

const ensureArray = <T>(obj?: T | T[]) => (Array.isArray(obj) ? obj : obj ? [obj] : [])
/** createTemplate function used for ssr */
export const createTemplate: CreateTemplate = memo((_tag, attrs) => {
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

  /** Now to determine what our root element is */
  const node = document.createElement(tag)

  /** handle JS reserved words commonly used in html class & for*/
  htmlFor && node.setAttribute('for', htmlFor)
  className && (node.className = className)
  /** if we have dataTrigger attribute wire up formatted correctly*/
  if (dataTrigger) {
    const value = Object.entries(dataTrigger)
      .map<string>(([ev, req]) => `${ev}->${req}`)
      .join(' ')
    node.dataset.trigger = value
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones */
      .map<string>(([prop, val]) => `${prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}:${val};`)
      .join(' ')
    node.style.cssText = value
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
      node.toggleAttribute(key, true)
      continue
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    node.setAttribute(kebabCase(key), trusted ? `${formattedValue}` : escape(`${formattedValue}`))
  }

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (voidTags.has(tag)) {
    return {
      stylesheets,
      node,
      string: node.outerHTML
    }
  }

  /** Test if the the tag is a string and if it's a custom element */
  const isCustomElement = customElementRegex.test(tag)

  const templateArr: string[] = ['<template ']
  if (isCustomElement) {
    
    /** Create opening tag of declarative shadowDom */
    templateArr.push(
      `shadowrootmode="${shadowrootmode}" `,
      `shadowrootdelegatesfocus="${shadowrootdelegatesfocus}" `,
      '/>'
    )
    /** We destructured out the stylesheet attribute as it's only for
     * custom elements declarative shadow dom  we create the style node
     * append the stylesheet as the first child of the declarative shadowDom template */
    if (stylesheets.size) {
      const sheets = [...stylesheets]
      templateArr.push(`<style>${sheets.join('')}</style>`)
      const style = document.createElement('style')
      style.append(sheets.join(''))
      node?.shadowRoot?.prepend(style)
    }
    stylesheets.clear()
    /** Set the mode and delegatesFocus of the shadowDom */
    node.attachShadow({ mode: shadowrootmode, delegatesFocus: shadowrootdelegatesfocus })
  }
  /** time to append the children to our template if we have em*/
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    /** P1 element is a customElement and child IS {@type Template}*/
    if (isCustomElement && typeof child === 'object' && 'node' in child) {
      templateArr.push(child.string)
      node?.shadowRoot?.append(child.node)
      for (const sheet of child.stylesheets) {
        !stylesheets.has(sheet) && stylesheets.add(sheet)
      }
      continue
    }
    /** P2 child IS {@type Template}*/
    if (typeof child === 'object' && 'node' in child) {
      node.append(child.node)
      for (const sheet of child.stylesheets) {
        !stylesheets.has(sheet) && stylesheets.add(sheet)
      }
      continue
    }
    /** P3 typeof child is NOT {@type Primitive} then skip and do nothing */
    if (!primitives.has(typeof child)) continue
    const formattedChild = validPrimitiveChildren.has(typeof child) ? child : ''
    /** P4 element is a customElement and child IS {@type Primitive} */
    if (isCustomElement) {
      const str = trusted ? `${formattedChild}`.trim() : escape(`${formattedChild}`).trim()
      templateArr.push(str)
      node?.shadowRoot?.append(str)
      continue
    }
    /** P5 child IS {@type Primitive} */
    node.append(trusted ? `${formattedChild}`.trim() : escape(`${formattedChild}`).trim())
  }
  if (isCustomElement) {
    /** close the template tag */
    templateArr.push('</template>')
    /** We need to append our slots outside the template and carry stylesheets forward **/
    const slots = !_slots ? [] : Array.isArray(_slots) ? _slots : [_slots]
    const length = slots.length
    for (let i = 0; i < length; i++) {
      const child = slots[i]
      /** P1 child IS {@type Template} */
      if (typeof child === 'object' && 'node' in child) {
        node.append(child.node)
        for (const sheet of child.stylesheets) {
          !stylesheets.has(sheet) && stylesheets.add(sheet)
        }
        continue
      }
      /** P2 typeof child is NOT {@type Primitive} then skip and do nothing */
      if (!primitives.has(typeof child)) continue
      /** P3 child IS {@type Template} */
      const formattedChild = validPrimitiveChildren.has(typeof child) ? child : ''
      node.append(trusted ? `${formattedChild}` : escape(`${formattedChild}`))
    }
  }
  const closingTag = `</${tag}>`
  const string = isCustomElement ? [removeClosingTag(node.outerHTML, closingTag), ...templateArr, closingTag].join(''): node.outerHTML
  console.log({
    stylesheets,
    node,
    string
  })
  return {
    stylesheets,
    node,
    string
  }
})

export { createTemplate as h }

export const  Fragment = ({ children: _children }: Attrs) =>{
  const children = ensureArray(_children)
  const stylesheets = new Set<string>()
  const length = children.length
  const template = document.createElement('template')
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (typeof child === 'string') {
      template.content.append(child)
      continue
    }
    template.content.append(child.node)
    for (const sheet of child.stylesheets) {
      !stylesheets.has(sheet) && stylesheets.add(sheet)
    }
  }
  return {
    node: template.content,
    string: template.innerHTML,
    stylesheets,
  }
}
