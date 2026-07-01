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
 * @see {@link fragment} for grouping without wrappers
 * @see {@link createStyles} for style creation
 */

import { htmlEscape, isTypeOf, trueTypeOf } from '../utils.ts'
import {
  BOOLEAN_ATTRS,
  CHILDREN,
  CUSTOM_ELEMENT_TAG_PATTERN,
  FLOW_CONTROL_HELPERS,
  P_FORM,
  P_SCALE,
  P_TARGET,
  P_TRIGGER,
  PRIMITIVES,
  SCALE,
  SCALE_RANK,
  SITE_ROOT_JAVASCRIPT_PATH_PATTERN,
  STYLE,
  STYLES,
  TEMPLATE_OBJECT_IDENTIFIER,
  VALID_PRIMITIVE_CHILDREN,
  VOID_TAGS,
} from './template.constants.ts'
import {
  type Children,
  type CustomElementTag,
  type DetailedHTMLAttributes,
  DetailedHTMLAttributesSchema,
  ElementAttributeListSchema,
  type TemplateObject,
} from './template.schemas.ts'

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

export class ScaleViolantionError extends Error implements Error {
  override name = 'scale_violation'
}

/**
 * @internal
 * Error thrown when a hyphenated tag is not a valid custom element tag.
 */
class InvalidCustomElementTagError extends Error implements Error {
  override name = 'invalid_custom_element_tag'
}

/**
 * @internal
 * Error thrown when schema-based attribute validation fails.
 */
class InvalidAttributeError extends Error implements Error {
  override name = 'invalid_attribute'
}

export const fragment = (_children: Children): TemplateObject => {
  const children = Array.isArray(_children) ? _children.flat() : [_children]
  const html: string[] = []
  const stylesheets: string[] = []
  const length = children.length
  let highestChildScale: keyof typeof SCALE = SCALE.rel
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (isTypeOf<Record<string, unknown>>(child, 'object') && child.$ === TEMPLATE_OBJECT_IDENTIFIER) {
      html.push(...child.html)
      stylesheets.push(...child.stylesheets)
      const { scale } = child
      if (SCALE_RANK[scale] > SCALE_RANK[highestChildScale]) {
        highestChildScale = scale
      }
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(trueTypeOf(child))) continue
    const safeChild = htmlEscape(`${child}`)
    html.push(safeChild)
  }
  return {
    html,
    stylesheets,
    scale: highestChildScale,
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }
}

/** @internal Narrows valid lowercase custom element tag names. */
const isCustomElementTag = (tag: string): tag is CustomElementTag => {
  return CUSTOM_ELEMENT_TAG_PATTERN.test(tag)
}

const DESTRUCTURED_ATTRIBUTES = new Set([CHILDREN, 'class', P_FORM, P_SCALE, P_TARGET, P_TRIGGER, STYLE, STYLES])

/**
 * @internal
 * Creates Plaited template objects from hyperscript-like calls.
 * Core template factory with security-first design and style management.
 *
 * @param _tag - HTML/SVG tag name, custom element tag, or FunctionTemplate
 * @param attrs - Element attributes including children and resolved styles
 * @returns TemplateObject with HTML, stylesheets, and identifier
 *
 * @throws {ScriptPolicyError} When `<script>` does not use a site-root JavaScript `src`
 * @throws {EventHandlerAttributeError} When `on*` attributes are used (use p-trigger instead)
 * @throws {InvalidAttributeTypeError} When non-primitive attribute values provided
 * @throws {InvalidCustomElementTagError} When a hyphenated tag is not a valid custom element tag
 * @throws {InvalidAttributeError} When attribute values fail per-tag schema validation
 *
 * @remarks
 * Security features:
 * - Automatic HTML escaping
 * - No inline event handlers
 * - External site-root script bootstrap only
 */
export const h = (
  _tag: string,
  {
    children: _children,
    class: cls,
    [P_FORM]: pForm,
    [P_SCALE]: pScale = 'rel',
    [P_TRIGGER]: pTrigger,
    style,
    styles,
    ...attrs
  }: DetailedHTMLAttributes = {},
): TemplateObject => {
  const tag = htmlEscape(_tag.trim().toLowerCase())
  if (tag.includes('-') && !isCustomElementTag(tag)) {
    throw new InvalidCustomElementTagError(`Invalid custom element tag: ${tag}`)
  }
  const normalizedAttributes: DetailedHTMLAttributes = {}
  for (const [key, value] of Object.entries(attrs)) {
    const normalizedKey = key.toLowerCase()
    if (DESTRUCTURED_ATTRIBUTES.has(normalizedKey)) continue
    normalizedAttributes[normalizedKey] = value
  }
  const tagSchema =
    tag in ElementAttributeListSchema.shape
      ? ElementAttributeListSchema.shape[tag as keyof typeof ElementAttributeListSchema.shape]
      : DetailedHTMLAttributesSchema
  const validationResult = tagSchema.safeParse(normalizedAttributes)
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new InvalidAttributeError(`Invalid attributes for <${tag}>: ${issues}`)
  }

  if (tag === 'script') {
    if (_children !== undefined) {
      throw new ScriptPolicyError('Script tags cannot contain inline content')
    }
    const src = normalizedAttributes.src
    if (typeof src !== 'string' || !SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test(src)) {
      throw new ScriptPolicyError('Script tags require a site-root JavaScript src')
    }
  }

  let classNames = new Set<string>()
  let stylesheets = []
  // ── Accumulate resolved StylesObject[] ─────────────────────────
  if (styles) {
    for (const styleObj of styles) {
      if (styleObj.classNames) {
        classNames = new Set([...classNames, ...styleObj.classNames])
      }
      stylesheets.push(...styleObj.stylesheets)
    }
  }

  const start = [`<${tag} `]
  // Handle JavaScript-reserved words commonly used in HTML.
  cls && classNames.add(htmlEscape(cls))
  if (classNames.size) start.push(`class="${[...classNames].join(' ')}" `)
  if (pTrigger) {
    const value = Object.entries(pTrigger)
      .map<string>(([ev, req]) => `${ev}:${req}`)
      .join(' ')
    start.push(`${P_TRIGGER}="${htmlEscape(value)}" `)
  }
  if (style) {
    const value = Object.entries(style)
      // Convert camelCase style props into dash-case unless they are CSS variables.
      .map<string>(([prop, val]) => `${prop}:${val};`)
      .join(' ')
    start.push(`style="${htmlEscape(value)}" `)
  }
  for (const key in normalizedAttributes) {
    // Events must be delegated via p-trigger instead of inline handler attributes.
    if (key.startsWith('on')) {
      throw new EventHandlerAttributeError(`Event handler attributes are not allowed: [${key}]`)
    }
    const value = normalizedAttributes[key]
    if (BOOLEAN_ATTRS.has(key)) {
      value && start.push(`${key} `)
      continue
    }
    if (value == null || value === '') continue
    if (!PRIMITIVES.has(trueTypeOf(value))) {
      throw new InvalidAttributeTypeError(`Attribute '${key}' must be a primitive type (string, number, boolean)`)
    }
    start.push(`${htmlEscape(key)}="${htmlEscape(`${value}`)}" `)
  }
  if (VOID_TAGS.has(tag)) {
    start.push('/>')
    return {
      html: start,
      stylesheets,
      scale: pScale,
      $: TEMPLATE_OBJECT_IDENTIFIER,
    }
  }
  start.push('>')
  const end: string[] = []
  const children = Array.isArray(_children) ? _children.flat() : [_children]
  const length = children.length
  let highestChildScale: keyof typeof SCALE = SCALE.rel
  for (let i = 0; i < length; i++) {
    const child = children[i]
    if (
      isTypeOf<Record<string, unknown>>(child, 'object') &&
      (child as Record<string, unknown>).$ === TEMPLATE_OBJECT_IDENTIFIER
    ) {
      const tpl = child as TemplateObject
      end.push(...tpl.html)
      stylesheets.unshift(...tpl.stylesheets)
      const { scale } = tpl
      if (scale !== SCALE.rel) {
        if (pScale === SCALE.rel) {
          if (
            (SCALE_RANK as Record<string, number>)[scale]! > (SCALE_RANK as Record<string, number>)[highestChildScale]!
          ) {
            highestChildScale = scale
          }
        } else {
          if ((SCALE_RANK as Record<string, number>)[scale]! > (SCALE_RANK as Record<string, number>)[pScale]!) {
            throw new ScaleViolantionError(
              `Cannot nest higher structural order element (${scale}) inside a lower structural boundary container (${pScale}) at tag <${tag}>.`,
            )
          }
        }
      }
      continue
    }
    if (!VALID_PRIMITIVE_CHILDREN.has(trueTypeOf(child))) continue
    end.push(htmlEscape(`${child}`))
  }
  end.push(`</${tag}>`)
  if (tag === 'template' && attrs?.shadowrootmode && stylesheets.length) {
    const styles = `<style>${[...new Set(stylesheets)].join('')}</style>`
    start.push(styles)

    stylesheets = []
  }
  return {
    html: [...start, ...end],
    stylesheets,
    $: TEMPLATE_OBJECT_IDENTIFIER,
    scale: pScale === SCALE.rel ? highestChildScale : pScale,
  }
}

export const getFlowControlPrefixMarker = (
  name: keyof typeof FLOW_CONTROL_HELPERS,
): `<!--? ${keyof typeof FLOW_CONTROL_HELPERS}` => `<!--? ${name}`
export const getFlowControlSuffixMarket = (
  name: Exclude<keyof typeof FLOW_CONTROL_HELPERS, typeof FLOW_CONTROL_HELPERS.val>,
): `<!--? end-${keyof typeof FLOW_CONTROL_HELPERS} -->` => `<!--? end-${name} -->`
export const getFlowControlIdMarker = (id: string | number) => `${id} -->`

export const $val = (val: string | number) =>
  `${getFlowControlPrefixMarker(FLOW_CONTROL_HELPERS.val)} ${getFlowControlIdMarker(val)}`

const makeFlowControl =
  (name: Exclude<keyof typeof FLOW_CONTROL_HELPERS, typeof FLOW_CONTROL_HELPERS.val>) =>
  (id: string, template: TemplateObject): TemplateObject => {
    const html = [
      getFlowControlPrefixMarker(name),
      getFlowControlIdMarker(id),
      ...template.html,
      getFlowControlSuffixMarket(name),
    ]
    return {
      html,
      stylesheets: template.stylesheets,
      scale: template.scale,
      $: TEMPLATE_OBJECT_IDENTIFIER,
    }
  }

export const $for = makeFlowControl(FLOW_CONTROL_HELPERS.for)
export const $switch = makeFlowControl(FLOW_CONTROL_HELPERS.switch)
export const $case = makeFlowControl(FLOW_CONTROL_HELPERS.case)
export const $default = makeFlowControl(FLOW_CONTROL_HELPERS.default)
export const $with = makeFlowControl(FLOW_CONTROL_HELPERS.with)
export const $slot = makeFlowControl(FLOW_CONTROL_HELPERS.slot)
