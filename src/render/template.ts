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

import { htmlEscape, isTypeOf, kebabCase, trueTypeOf } from '../utils.ts'
import {
  BOOLEAN_ATTRS,
  CUSTOM_ELEMENT_TAG_PATTERN,
  P_TRIGGER,
  PRIMITIVES,
  RESERVED_CUSTOM_ELEMENT_TAGS,
  SITE_ROOT_JAVASCRIPT_PATH_PATTERN,
  TEMPLATE_OBJECT_IDENTIFIER,
  VALID_PRIMITIVE_CHILDREN,
  VOID_TAGS,
} from './template.constants.ts'
import type {
  Attrs,
  CustomElementTag,
  DetailedCustomElementHTMLAttributes,
  ElementAttributeList,
  FunctionTemplate,
  TemplateObject,
} from './template.types.ts'

/**
 * @internal
 * Error thrown when a script tag violates the external bootstrap script policy.
 */
class ScriptPolicyError extends Error implements Error {
  override name = 'script_policy'
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

/**
 * @internal
 * Error thrown when a hyphenated tag is not a valid custom element tag.
 */
class InvalidCustomElementTagError extends Error implements Error {
  override name = 'invalid_custom_element_tag'
}

/** @internal Valid tag input for JSX rendering: built-in tag name, custom element tag, or `FunctionTemplate`. */
type Tag = string | CustomElementTag | FunctionTemplate

/** @internal Infers the correct attribute type for a given `Tag`. */
type InferAttrs<T extends Tag> = T extends keyof ElementAttributeList
  ? ElementAttributeList[T]
  : T extends FunctionTemplate
    ? Parameters<T>[0]
    : T extends CustomElementTag
      ? DetailedCustomElementHTMLAttributes
      : Attrs

/** @internal Type signature for `createTemplate`, preserving type safety between the tag and its attributes. */
type CreateTemplate = <T extends Tag>(tag: T, attrs: InferAttrs<T>) => TemplateObject

/** @internal Narrows valid lowercase custom element tag names. */
export const isCustomElementTag = (tag: string): tag is CustomElementTag => {
  return CUSTOM_ELEMENT_TAG_PATTERN.test(tag) && !RESERVED_CUSTOM_ELEMENT_TAGS.has(tag)
}

/**
 * @internal
 * Creates Plaited template objects from JSX-like calls.
 * Core template factory with security-first design and style management.
 *
 * @param _tag - HTML/SVG tag name, custom element tag, or FunctionTemplate
 * @param attrs - Element attributes including children
 * @returns TemplateObject with HTML, stylesheets, registry, and identifier
 *
 * @throws {ScriptPolicyError} When `<script>` does not use a site-root JavaScript `src`
 * @throws {EventHandlerAttributeError} When `on*` attributes are used (use p-trigger instead)
 * @throws {InvalidAttributeTypeError} When non-primitive attribute values provided
 * @throws {InvalidCustomElementTagError} When a hyphenated tag is not a valid custom element tag
 *
 * @remarks
 * Security features:
 * - Automatic HTML escaping
 * - No inline event handlers
 * - External site-root script bootstrap only
 *
 * @see {@link h} for JSX factory alias
 * @see {@link Fragment} for grouping elements
 */
export const createTemplate: CreateTemplate = (_tag, attrs) => {
  const {
    children: _children,
    stylesheets = [],
    style,
    'p-trigger': pTrigger,
    'p-topic': _pTopic,
    class: cls,
    classNames,
    for: htmlFor,
    ...attributes
  } = attrs

  if (isTypeOf<FunctionTemplate>(_tag, 'function')) {
    return _tag(attrs)
  }
  const tag = htmlEscape(_tag.trim().toLowerCase())
  if (tag.includes('-') && !isCustomElementTag(tag)) {
    throw new InvalidCustomElementTagError(`Invalid custom element tag: ${tag}`)
  }
  const registry: CustomElementTag[] = isCustomElementTag(tag) ? [tag] : []

  if (tag === 'script') {
    if (_children !== undefined) {
      throw new ScriptPolicyError('Script tags cannot contain inline content')
    }
    const src = attributes.src
    if (typeof src !== 'string' || !SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test(src)) {
      throw new ScriptPolicyError('Script tags require a site-root JavaScript src')
    }
  }
  const start = [`<${tag} `]
  // Handle JavaScript-reserved words commonly used in HTML.
  if (htmlFor) start.push(`for="${htmlEscape(htmlFor)}" `)
  const classes = new Set(classNames)
  cls && classes.add(htmlEscape(cls))
  if (classes.size) start.push(`class="${[...classes].join(' ')}" `)
  if (pTrigger) {
    const value = Object.entries(pTrigger)
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
    start.push(`${htmlEscape(key)}="${htmlEscape(value)}" `)
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
    end.push(htmlEscape(`${child}`))
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
  const registry: CustomElementTag[] = []
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
