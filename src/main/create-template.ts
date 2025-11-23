/**
 * @internal
 * @module create-template
 *
 * Purpose: Implements the JSX template creation system for Plaited.
 * Converts JSX-like calls into template objects with security-first design.
 * Handles HTML escaping, event binding, style management, and Shadow DOM boundaries.
 *
 * Architecture:
 * - Core factory function for JSX runtime integration
 * - Recursive template object generation with nested children support
 * - Automatic HTML escaping for security
 * - Style hoisting and deduplication
 * - Script injection protection
 *
 * Dependencies:
 * - utils.js: Type checking, kebab-case conversion, HTML escaping
 * - create-template.types.js: Type definitions for attributes and templates
 * - create-template.constants.js: HTML constants and valid tags
 *
 * Consumers:
 * - JSX transpiler output (h function calls)
 * - bElement for Shadow DOM template creation
 * - Application code using JSX syntax
 *
 * @example Basic element creation
 * ```tsx
 * import { h } from 'plaited/jsx-runtime'
 *
 * const div = h('div', {
 *   class: 'container',
 *   children: 'Hello World'
 * });
 * ```
 *
 * @example Component composition
 * ```tsx
 * const Card = ({ title, children }) => h('div', {
 *   class: 'card',
 *   children: [
 *     h('h2', { children: title }),
 *     h('div', { class: 'content', children })
 *   ]
 * });
 *
 * const card = h(Card, {
 *   title: 'Welcome',
 *   children: 'Card content'
 * });
 * ```
 *
 * @example Shadow DOM with styles
 * ```tsx
 * import { styles } from 'plaited';
 *
 * const componentStyles = styles({
 *   container: {
 *     padding: '1rem',
 *     border: '1px solid #ccc'
 *   }
 * });
 *
 * const ShadowComponent = () => h('custom-element', {
 *   children: h('template', {
 *     shadowrootmode: 'open',
 *     children: h('div', {
 *       ...componentStyles.container,
 *       children: 'Shadow content'
 *     })
 *   })
 * });
 * ```
 *
 * @remarks
 * Key features:
 * - Automatic HTML escaping
 * - Declarative event system via p-trigger
 * - Style hoisting and deduplication
 * - Shadow DOM boundaries
 * - Script injection protection
 *
 * @see {@link Fragment} for grouping without wrappers
 * @see {@link styles} for style creation
 */

import { htmlEscape, isTypeOf, kebabCase, trueTypeOf } from '../utils.ts'
import {
  BOOLEAN_ATTRS,
  P_TRIGGER,
  PRIMITIVES,
  TEMPLATE_OBJECT_IDENTIFIER,
  VALID_PRIMITIVE_CHILDREN,
  VOID_TAGS,
} from './create-template.constants.ts'
import type {
  Attrs,
  CustomElementTag,
  DetailedHTMLAttributes,
  ElementAttributeList,
  FunctionTemplate,
  TemplateObject,
} from './create-template.types.ts'

/** @internal Represents the possible types for a tag in a JSX element: a standard HTML/SVG tag name (string), a custom element tag name (string with hyphen), or a FunctionTemplate component. */
type Tag = string | CustomElementTag | FunctionTemplate

/** @internal Utility type to infer the correct attribute type (`Attrs`) based on the provided tag type (`Tag`). It maps standard tags to their detailed attributes, FunctionTemplates to their parameter types, and custom elements/other strings to default detailed attributes. */
type InferAttrs<T extends Tag> = T extends keyof ElementAttributeList
  ? ElementAttributeList[T]
  : T extends FunctionTemplate
    ? Parameters<T>[0]
    : T extends CustomElementTag
      ? DetailedHTMLAttributes
      : Attrs

/** @internal The signature for the core template creation function (`createTemplate`). Ensures type safety between the tag and its attributes. */
type CreateTemplate = <T extends Tag>(tag: T, attrs: InferAttrs<T>) => TemplateObject

/**
 * Creates Plaited template objects from JSX-like calls.
 * Core template factory with security-first design and style management.
 *
 * @param _tag - HTML/SVG tag name, custom element tag, or FunctionTemplate
 * @param attrs - Element attributes including children
 * @returns TemplateObject with HTML, stylesheets, registry, and identifier
 *
 * @example Standard element
 * ```tsx
 * const template = createTemplate('div', {
 *   class: 'container',
 *   children: ['Hello World']
 * });
 * ```
 *
 * @example With event triggers
 * ```tsx
 * const button = createTemplate('button', {
 *   'p-trigger': { click: 'SUBMIT' },
 *   children: 'Submit'
 * });
 * ```
 *
 * @example Style object
 * ```tsx
 * const styled = createTemplate('div', {
 *   style: {
 *     padding: '10px',
 *     '--custom-var': 'blue'
 *   },
 *   children: 'Styled content'
 * });
 * ```
 *
 * @throws {Error} When `on*` attributes are used (use p-trigger instead)
 * @throws {Error} When `<script>` tag used without `trusted={true}`
 * @throws {Error} When non-primitive attribute values provided
 *
 * @remarks
 * Security features:
 * - Automatic HTML escaping
 * - No inline event handlers
 * - Script tag protection
 * - Trusted content opt-in
 *
 * @see {@link h} for JSX factory alias
 * @see {@link Fragment} for grouping elements
 */
export const createTemplate: CreateTemplate = (_tag, attrs) => {
  const {
    children: _children,
    trusted,
    stylesheets = [],
    style,
    'p-trigger': bpTrigger,
    class: cls,
    classNames,
    for: htmlFor,
    ...attributes
  } = attrs

  const registry: string[] = []
  if (isTypeOf<FunctionTemplate>(_tag, 'function')) {
    return _tag(attrs)
  }
  const tag = htmlEscape(_tag.toLowerCase().trim())

  /** If the tag is script we must explicitly pass trusted */
  if (tag === 'script' && !trusted) {
    throw new Error("Script tag not allowed unless 'trusted' property set")
  }
  /** Now to create an array to store our node attributes */
  const start = [`<${tag} `]
  /** handle JS reserved words commonly used in html class & for*/
  if (htmlFor) start.push(`for="${htmlEscape(htmlFor)}" `)
  const classes = new Set(classNames)
  cls && classes.add(htmlEscape(cls))
  if (classes.size) start.push(`class="${[...classes].join(' ')}" `)
  /** if we have bpTrigger attribute wire up formatted correctly*/
  if (bpTrigger) {
    const value = Object.entries(bpTrigger)
      .map<string>(([ev, req]) => `${ev}:${req}`)
      .join(' ')
    start.push(`${P_TRIGGER}="${htmlEscape(value)}" `)
  }
  /** if we have style add it to element */
  if (style) {
    const value = Object.entries(style)
      /** convert camelCase style prop into dash-case ones so long as not cssVar */
      .map<string>(([prop, val]) => `${prop.startsWith('--') ? prop : kebabCase(prop)}:${val};`)
      .join(' ')
    start.push(`style="${htmlEscape(value)}" `)
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
    start.push(`${htmlEscape(key)}="${trusted ? value : htmlEscape(value)}" `)
  }
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
      stylesheets.unshift(...child.stylesheets)
      registry.push(...child.registry)
      continue
    }
    /** P2 typeof child is NOT a valid primitive child then skip and do nothing */
    if (!VALID_PRIMITIVE_CHILDREN.has(trueTypeOf(child))) continue
    /** P3 child IS {@type Primitive} */
    const str = trusted ? `${child}` : htmlEscape(`${child}`)
    end.push(str)
  }
  end.push(`</${tag}>`)
  return {
    html: [...start, ...end],
    stylesheets: [...new Set(stylesheets)],
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}

/**
 * JSX factory function alias for createTemplate.
 * Standard entry point for JSX transformation.
 *
 * @example JSX usage
 * ```tsx
 * import { h } from 'plaited/jsx-runtime';
 *
 * const element = h('div', {
 *   id: 'example',
 *   class: 'container',
 *   children: 'Hello World'
 * });
 * ```
 *
 * @see {@link createTemplate} for implementation details
 */
export { createTemplate as h }

/**
 * JSX Fragment for grouping elements without wrapper nodes.
 * Collects child HTML and stylesheets into single template object.
 *
 * @param attrs - Attributes object containing children
 * @returns TemplateObject with combined HTML and stylesheets
 *
 * @example List items without wrapper
 * ```tsx
 * const listItems = (
 *   <Fragment>
 *     <li>Item 1</li>
 *     <li>Item 2</li>
 *   </Fragment>
 * );
 * ```
 *
 * @example Mixed content
 * ```tsx
 * const content = (
 *   <Fragment>
 *     <h2>Title</h2>
 *     <p>Paragraph</p>
 *     {'Text node'}
 *   </Fragment>
 * );
 * ```
 *
 * @example With styles
 * ```tsx
 * const styled = (
 *   <Fragment>
 *     <div {...styles.box}>Box 1</div>
 *     <div {...styles.box}>Box 2</div>
 *   </Fragment>
 * );
 * ```
 *
 * @remarks
 * Use cases:
 * - Avoid wrapper divs
 * - Return multiple elements
 * - Conditional rendering
 * - List mapping
 *
 * @see {@link createTemplate} for element creation
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
    const safeChild = htmlEscape(`${child}`)
    html.push(safeChild)
  }
  return {
    html,
    stylesheets: [...new Set(stylesheets)],
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}
