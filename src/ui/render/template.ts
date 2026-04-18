/**
 * @internal
 * @module create-template
 *
 * Purpose: JSX template creation system for Plaited with security-first design.
 * Converts JSX calls into template objects with HTML escaping, event binding, and style management.
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
 * @see {@link createStyles} for style creation
 */

import { htmlEscape, isTypeOf, kebabCase, trueTypeOf } from '../../utils.ts'
import {
  BOOLEAN_ATTRS,
  P_TRIGGER,
  PRIMITIVES,
  TEMPLATE_OBJECT_IDENTIFIER,
  VALID_PRIMITIVE_CHILDREN,
  VOID_TAGS,
} from './template.constants.ts'
import type {
  Attrs,
  CustomElementTag,
  DetailedHTMLAttributes,
  ElementAttributeList,
  FunctionTemplate,
  TemplateObject,
} from './template.types.ts'

/**
 * @internal
 * Error thrown when a script tag is used without the 'trusted' property.
 */
class UntrustedScriptError extends Error implements Error {
  override name = 'untrusted_script'
}

/**
 * @internal
 * Error thrown when on* event handler attributes are used.
 * All events must use the p-trigger declarative event system.
 */
class EventHandlerAttributeError extends Error implements Error {
  override name = 'event_handler_attribute'
}

/**
 * @internal
 * Error thrown when a non-primitive attribute value is provided.
 */
class InvalidAttributeTypeError extends Error implements Error {
  override name = 'invalid_attribute_type'
}

/** @internal Valid tag input for JSX rendering: built-in tag name, custom element tag, or `FunctionTemplate`. */
type Tag = string | CustomElementTag | FunctionTemplate

/** @internal Infers the correct attribute type for a given `Tag`. */
type InferAttrs<T extends Tag> = T extends keyof ElementAttributeList
  ? ElementAttributeList[T]
  : T extends FunctionTemplate
    ? Parameters<T>[0]
    : T extends CustomElementTag
      ? DetailedHTMLAttributes
      : Attrs

/** @internal Type signature for `createTemplate`, preserving type safety between the tag and its attributes. */
type CreateTemplate = <T extends Tag>(tag: T, attrs: InferAttrs<T>) => TemplateObject

/**
 * @internal
 * Creates Plaited template objects from JSX-like calls.
 * Core template factory with security-first design and style management.
 *
 * @param _tag - HTML/SVG tag name, custom element tag, or FunctionTemplate
 * @param attrs - Element attributes including children
 * @returns TemplateObject with HTML, stylesheets, registry, and identifier
 *
 * @throws {UntrustedScriptError} When `<script>` tag used without `trusted={true}`
 * @throws {EventHandlerAttributeError} When `on*` attributes are used (use p-trigger instead)
 * @throws {InvalidAttributeTypeError} When non-primitive attribute values provided
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

  // Script tags require an explicit trust boundary.
  if (tag === 'script' && !trusted) {
    throw new UntrustedScriptError("Script tag requires 'trusted' property to be set")
  }
  const start = [`<${tag} `]
  // Handle JavaScript-reserved words commonly used in HTML.
  if (htmlFor) start.push(`for="${htmlEscape(htmlFor)}" `)
  const classes = new Set(classNames)
  cls && classes.add(htmlEscape(cls))
  if (classes.size) start.push(`class="${[...classes].join(' ')}" `)
  if (bpTrigger) {
    const value = Object.entries(bpTrigger)
      .map<string>(([ev, req]) => `${ev}:${req}`)
      .join(' ')
    start.push(`${P_TRIGGER}="${htmlEscape(value)}" `)
  }
  if (style) {
    const value = Object.entries(style)
      // Convert camelCase style props into dash-case unless they are CSS variables.
      .map<string>(([prop, val]) => `${prop.startsWith('--') ? prop : kebabCase(prop)}:${val};`)
      .join(' ')
    start.push(`style="${htmlEscape(value)}" `)
  }
  for (const key in attributes) {
    // Events must be delegated via p-trigger instead of inline handler attributes.
    if (key.startsWith('on')) {
      throw new EventHandlerAttributeError(`Event handler attributes are not allowed: [${key}]`)
    }
    const value = attributes[key]
    if (BOOLEAN_ATTRS.has(key)) {
      value && start.push(`${key} `)
      continue
    }
    if (value == null || value === '') continue
    if (!PRIMITIVES.has(trueTypeOf(value))) {
      throw new InvalidAttributeTypeError(`Attribute '${key}' must be a primitive type (string, number, boolean)`)
    }
    start.push(`${htmlEscape(key)}="${trusted ? value : htmlEscape(value)}" `)
  }
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
  const children = Array.isArray(_children) ? _children.flat() : [_children]
  const length = children.length
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      end.push(...child.html)
      stylesheets.unshift(...child.stylesheets)
      registry.push(...child.registry)
      continue
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(trueTypeOf(child))) continue
    const str = trusted ? `${child}` : htmlEscape(`${child}`)
    end.push(str)
  }
  end.push(`</${tag}>`)
  return {
    html: [...start, ...end],
    stylesheets,
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}

/**
 * @internal
 * JSX factory function alias for createTemplate.
 * Standard entry point for JSX transformation.
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
    stylesheets,
    registry,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}
