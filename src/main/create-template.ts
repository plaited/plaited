/**
 * Plaited JSX Template Creation System
 *
 * Core module for converting JSX-like calls into Plaited template objects.
 * Provides security-first template creation with automatic style management
 * and declarative shadow DOM support.
 *
 * @packageDocumentation
 *
 * @example
 * Basic Element Creation
 * ```tsx
 * import { h } from 'plaited/jsx-runtime'
 *
 * const div = h('div', {
 *   class: 'container',
 *   children: 'Hello World'
 * })
 * ```
 *
 * @example
 * Custom Component
 * ```tsx
 * const Card = ({ title, children }) => h('div', {
 *   class: 'card',
 *   children: [
 *     h('h2', { children: title }),
 *     h('div', { class: 'content', children })
 *   ]
 * })
 *
 * const card = h(Card, {
 *   title: 'Welcome',
 *   children: 'Card content'
 * })
 * ```
 *
 * @example
 * Shadow DOM and Styles
 * ```tsx
 * import { css } from 'plaited'
 *
 * const styles = css.create({
 *   container: {
 *     padding: '1rem',
 *     border: '1px solid #ccc'
 *   }
 * })
 *
 * const ShadowComponent = () => h('custom-element', {
 *   children: h('template', {
 *     shadowrootmode: 'open',
 *     children: h('div', {
 *       ...styles.container,
 *       children: 'Shadow content'
 *     })
 *   })
 * })
 * ```
 *
 * @example
 * Event Handling
 * ```tsx
 * const Button = () => h('button', {
 *   'p-trigger': {
 *     click: 'BUTTON_CLICKED',
 *     focus: 'BUTTON_FOCUSED'
 *   },
 *   children: 'Click me'
 * })
 * ```
 *
 * @remarks
 * Security Features:
 * 1. HTML Escaping
 *    - Automatic escaping of attribute values
 *    - Child content sanitization
 *    - Opt-in trusted content via `trusted` prop
 *
 * 2. Event Safety
 *   - No `on*` event handlers allowed
 *   - Uses declarative `p-trigger` system
 *   - Prevents script injection attacks
 *
 * 3. Script Protection
 *   - `<script>` tags require explicit `trusted={true}`
 *   - Inline scripts blocked by default
 *
 * Style Management:
 * 1. Stylesheet Hoisting
 *   - Automatic collection up component tree
 *   - Deduplication via Set
 *   - Shadow DOM boundary awareness
 *
 * 2. Style Attributes
 *   - Object syntax with camelCase props
 *   - CSS variable support
 *   - Auto kebab-case conversion
 *
 * Shadow DOM Support:
 * - Declarative shadow root creation
 * - Automatic style injection
 * - Focus delegation
 * - Slot management
 *
 * Best Practices:
 * 1. Security
 *   - Never use `trusted={true}` with untrusted content
 *   - Validate all dynamic attribute values
 *   - Use `p-trigger` for events, not `on*` attributes
 *
 * 2. Performance
 *   - Keep templates small and focused
 *   - Use Fragment to avoid wrapper elements
 *   - Leverage stylesheet hoisting
 *
 * 3. Styles
 *   - Use CSS modules with `css.create()`
 *   - Leverage shadow DOM for style encapsulation
 *   - Group related styles in objects
 */

import { isTypeOf, trueTypeOf, kebabCase, escape } from '../utils.js'
import type {
  Attrs,
  DetailedHTMLAttributes,
  TemplateObject,
  ElementAttributeList,
  CustomElementTag,
  FunctionTemplate,
} from './jsx.types.js'
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
 *
 * @param _tag - The tag name (string for HTML/SVG/custom elements) or a FunctionTemplate
 * @param attrs - The attributes/props object for the element, including `children`
 * @returns A `TemplateObject` containing the processed HTML strings (`html`), collected stylesheets (`stylesheets`), registry info (`registry`), and an identifier (`$`)
 * @throws {Error} If an `on*` attribute (e.g., `onclick`) is used. Event handling should use `p-trigger`
 * @throws {Error} If a `<script>` tag is used without the `trusted={true}` attribute
 * @throws {Error} If an attribute value is not a primitive type (string, number, boolean, null, undefined), excluding Plaited-specific object/array types
 *
 * @example
 * ```ts
 * const template = createTemplate('div', {
 *   class: 'container',
 *   children: ['Hello World']
 * });
 * ```
 *
 * Key responsibilities include:
 * - Handling standard HTML/SVG tags, custom element tags, and FunctionTemplates
 * - Sanitizing attribute values and child content via HTML escaping (unless the `trusted` attribute is `true`)
 * - Correctly formatting boolean attributes (e.g., `disabled`, `checked`)
 * - Processing Plaited-specific attributes:
 *   - `p-trigger`: Serializes event-to-action mappings
 *   - `stylesheet`: Collects stylesheet strings for hoisting
 *   - `style`: Converts a style object into an inline style string
 *   - `trusted`: Disables escaping for the element's attributes and children (use with caution)
 * - Hoisting stylesheets up the template tree until a declarative shadow DOM boundary (`<template shadowrootmode="...">`) is encountered
 * - Preventing potentially unsafe constructs like `on*` event handler attributes and `<script>` tags without the `trusted` attribute
 */
export const createTemplate: CreateTemplate = (_tag, attrs) => {
  const {
    children: _children,
    trusted,
    stylesheet = [],
    style,
    'p-trigger': bpTrigger,
    class: cls,
    className,
    for: htmlFor,
    ...attributes
  } = attrs

  const registry: string[] = []
  if (isTypeOf<FunctionTemplate>(_tag, 'function')) {
    return _tag(attrs)
  }
  const tag = escape(_tag.toLowerCase().trim())

  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error("Script tag not allowed unless 'trusted' property set")
  }
  /** Now to create an array to store our node attributes */
  const start = [`<${tag} `]
  /** handle JS reserved words commonly used in html class & for*/
  if (htmlFor) start.push(`for="${escape(htmlFor)}" `)
  const classes = new Set(className)
  cls && classes.add(escape(cls))
  if (classes.size) start.push(`class="${[...classes].join(' ')}" `)
  /** if we have bpTrigger attribute wire up formatted correctly*/
  if (bpTrigger) {
    const value = Object.entries(bpTrigger)
      .map<string>(([ev, req]) => `${ev}:${req}`)
      .join(' ')
    start.push(`${P_TRIGGER}="${escape(value)}" `)
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
    if (value == null || value === '') continue
    if (!PRIMITIVES.has(trueTypeOf(value))) {
      /** P2 typeof attribute is NOT {@type Primitive} then skip and do nothing */
      throw new Error(`Attributes not declared in PlaitedAttributes must be of type Primitive: ${key} is not primitive`)
    }
    /** handle the rest of the attributes */
    start.push(`${escape(key)}="${trusted ? value : escape(value)}" `)
  }
  /** Our tag is a void tag so we can return it once we apply attributes */
  if (VOID_TAGS.has(tag)) {
    start.push('/>')
    return {
      html: start,
      stylesheets: [...new Set(stylesheet)],
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
      stylesheet.unshift(...child.stylesheets)
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
  return {
    html: [...start, ...end],
    stylesheets: [...new Set(stylesheet)],
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}

/**
 * Alias for `createTemplate`, commonly used as the JSX factory function (`jsx` or `jsxs` in JSX transform).
 * This follows the convention established by react-jsx and adopted by many JSX frameworks.
 *
 * @see createTemplate For detailed behavior and parameters
 *
 * @example
 * ```ts
 * import { h } from 'plaited/jsx-runtime';
 *
 * const element = h('div', {
 *   id: 'example',
 *   class: 'container',
 *   children: 'Hello World'
 * });
 *
 * const templateFunction = h(MyTemplateFunction, {
 *   data: 'some data'
 * });
 * ```
 */
export { createTemplate as h }

/**
 * Represents a JSX Fragment. Allows grouping multiple children without adding an extra wrapper node
 * to the resulting HTML structure. It processes its children, collecting their HTML fragments
 * and stylesheets into a single `TemplateObject`.
 *
 * @param attrs - An attributes object, primarily used to access the `children` prop (other attributes are ignored)
 * @returns A `TemplateObject` containing the combined HTML and stylesheets of its direct children
 *
 * @example
 * ```tsx
 * import { Fragment, h } from 'plaited/jsx-runtime';
 *
 * const listItems = (
 *   <Fragment>
 *     <li>Item 1</li>
 *     <li>Item 2</li>
 *   </Fragment>
 * );
 * // Resulting TemplateObject.html: ['<li>Item 1</li>', '<li>Item 2</li>']
 *
 * const mixedContent = h('div', {
 *   children: (
 *     <Fragment>
 *       <span>Part 1</span>
 *       {' Part 2'}
 *     </Fragment>
 *   )
 * });
 * // Resulting TemplateObject.html: ['<div>', '<span>Part 1</span>', ' Part 2', '</div>']
 * ```
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
