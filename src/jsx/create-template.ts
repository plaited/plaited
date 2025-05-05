import type {
  Attrs,
  DetailedHTMLAttributes,
  TemplateObject,
  ElementAttributeList,
  CustomElementTag,
  FunctionTemplate,
} from './jsx.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
import { trueTypeOf } from '../utils/true-type-of.js'
import { kebabCase } from '../utils/case.js'
import { escape } from '../utils/escape.js'
import {
  BOOLEAN_ATTRS,
  PRIMITIVES,
  VOID_TAGS,
  VALID_PRIMITIVE_CHILDREN,
  P_TRIGGER,
  TEMPLATE_OBJECT_IDENTIFIER,
} from './jsx.constants.js'

/** @internal Represents the possible types for a tag in a JSX element: a standard HTML/SVG tag name (string), a custom element tag name (string with hyphen), or a FunctionTemplate component. */
type Tag = string | CustomElementTag | FunctionTemplate

/** @internal Utility type to infer the correct attribute type (`Attrs`) based on the provided tag type (`Tag`). It maps standard tags to their detailed attributes, FunctionTemplates to their parameter types, and custom elements/other strings to default detailed attributes. */
type InferAttrs<T extends Tag> =
  T extends keyof ElementAttributeList ? ElementAttributeList[T]
  : T extends FunctionTemplate ? Parameters<T>[0]
  : T extends CustomElementTag ? DetailedHTMLAttributes
  : Attrs

/** @internal The signature for the core template creation function (`createTemplate`). Ensures type safety between the tag and its attributes. */
type CreateTemplate = <T extends Tag>(tag: T, attrs: InferAttrs<T>) => TemplateObject

/**
 * Core function for creating Plaited template objects from JSX-like calls.
 * This function is typically invoked via the `h` alias (inspired by react=jsx).
 * It processes tags, attributes, and children to produce a `TemplateObject`
 * which includes HTML string fragments and associated stylesheets, ready for rendering or further processing.
 *
 * Key responsibilities include:
 * - Handling standard HTML/SVG tags, custom element tags, and FunctionTemplate components.
 * - Sanitizing attribute values and child content via HTML escaping (unless the `trusted` attribute is `true`).
 * - Correctly formatting boolean attributes (e.g., `disabled`, `checked`).
 * - Handling special attributes like `className` (maps to `class`), `htmlFor` (maps to `for`).
 * - Processing Plaited-specific attributes:
 *   - `p-trigger`: Serializes event-to-action mappings.
 *   - `stylesheet`: Collects stylesheet strings for hoisting.
 *   - `style`: Converts a style object into an inline style string.
 *   - `trusted`: Disables escaping for the element's attributes and children (use with caution).
 * - Hoisting stylesheets up the template tree until a declarative shadow DOM boundary (`<template shadowrootmode="...">`) is encountered, where they are injected as a `<style>` tag.
 * - Preventing potentially unsafe constructs like `on*` event handler attributes and `<script>` tags without the `trusted` attribute.
 *
 * @param _tag The tag name (string for HTML/SVG/custom elements) or a FunctionTemplate component.
 * @param attrs The attributes/props object for the element or component, including `children`.
 * @returns A `TemplateObject` containing the processed HTML strings (`html`), collected stylesheets (`stylesheets`), component registry info (`registry`), and an identifier (`$`).
 * @throws {Error} If an `on*` attribute (e.g., `onclick`) is used. Event handling should use `p-trigger`.
 * @throws {Error} If a `<script>` tag is used without the `trusted={true}` attribute.
 * @throws {Error} If an attribute value is not a primitive type (string, number, boolean, null, undefined), excluding Plaited-specific object/array types like `style`, `p-trigger`, `stylesheet`, `className`, `children`.
 * @example
 * const template = createTemplate('div', {
 *   className: 'container',
 *   children: ['Hello World']
 * });
 */
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
  if (isTypeOf<FunctionTemplate>(_tag, 'function')) {
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
  if (className) start.push(`class="${Array.isArray(className) ? className.join(' ') : className}" `)
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
    if (!PRIMITIVES.has(trueTypeOf(value))) {
      throw new Error(`Attributes not declared in PlaitedAttributes must be of type Primitive: ${key} is not primitive`)
    }
    /** set the value so long as it's not nullish in we use the formatted value  */
    const formattedValue = value ?? ''
    /** handle the rest of the attributes */
    start.push(`${key}="${trusted ? formattedValue : escape(formattedValue)}" `)
  }
  /** Create are stylesheet set */
  let stylesheets = stylesheet ? [...(Array.isArray(stylesheet) ? stylesheet : [stylesheet])] : []

  /** Our tag is a void tag so we can return it once we apply attributes */
  if (VOID_TAGS.has(tag)) {
    start.push('/>')
    return {
      html: start,
      stylesheets: [...new Set(stylesheets)],
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
    if (!VALID_PRIMITIVE_CHILDREN.has(trueTypeOf(child))) continue
    /** P3 child IS {@type Primitive} */
    const str = trusted ? `${child}` : escape(`${child}`)
    end.push(str)
  }
  end.push(`</${tag}>`)
  /** Test if the the tag is a template and if it's a declarative shadow dom */
  stylesheets = [...new Set(stylesheets)]
  if (isDeclarativeShadowDom) {
    /** We continue to hoist our stylesheet until we run
     * into a declarative shadow dom then we push the
     * stylesheet as the first child of the declarative
     * shadowDom template array  and clear the stylesheets set
     */
    if (stylesheets.length) {
      start.push(`<style>${stylesheets.join('')}</style>`)
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

/**
 * Alias for `createTemplate`, commonly used as the JSX factory function (`jsx` or `jsxs` in JSX transform).
 * This follows the convention established by react-jsx and adopted by many JSX frameworks, providing a concise way to create elements.
 *
 * @see createTemplate For detailed behavior and parameters.
 * @example
 * import { h } from 'plaited/jsx-runtime';
 *
 * const element = h('div', { id: 'example', className: 'container', children: 'Hello World' });');
 * const component = h(MyComponent, { data: 'some data' });
 */
export { createTemplate as h }

/**
 * Represents a JSX Fragment. Allows grouping multiple children without adding an extra wrapper node to the resulting HTML structure.
 * It processes its children, collecting their HTML fragments and stylesheets into a single `TemplateObject`.
 *
 * @param attrs An attributes object, primarily used to access the `children` prop. Other attributes passed to Fragment are ignored.
 * @returns A `TemplateObject` containing the combined HTML and stylesheets of its direct children.
 * @example
 * import { Fragment, h } from 'plaited/jsx-runtime';
 *
 * const listItems = (
 *   <Fragment>
 *     <li>Item 1</li>
 *     <li>Item 2</li>
 *   </Fragment>
 * );
 * // Resulting TemplateObject.html roughly: ['<li>Item 1</li>', '<li>Item 2</li>']
 *
 * const mixedContent = h('div', {
 * children: (
 *      <Fragment>
 *        <span>Part 1</span>
 *        {' Part 2'}
 *      </Fragment>
 *    )
 *  }
 * );
 * // Resulting TemplateObject.html roughly: ['<div>', '<span>Part 1</span>', ' Part 2', '</div>']
 */
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
    if (!VALID_PRIMITIVE_CHILDREN.has(trueTypeOf(child))) continue
    const safeChild = escape(`${child}`)
    html.push(safeChild)
  }
  return {
    html,
    stylesheets: [...new Set(stylesheets)],
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}
