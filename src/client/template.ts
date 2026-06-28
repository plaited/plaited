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

import { htmlEscape, isTypeOf, kebabCase, trueTypeOf } from '../utils.ts'
import type { CSSProperties } from './css.types.ts'
import {
  BOOLEAN_ATTRS,
  CUSTOM_ELEMENT_TAG_PATTERN,
  FLOW_CONTROL_HELPERS,
  P_FORM,
  P_SCALE,
  P_TRIGGER,
  PRIMITIVES,
  SCALE,
  SCALE_RANK,
  SITE_ROOT_JAVASCRIPT_PATH_PATTERN,
  TEMPLATE_OBJECT_IDENTIFIER,
  VALID_PRIMITIVE_CHILDREN,
  VOID_TAGS,
} from './template.constants.ts'
import type { Bind, StyleRef } from './template.schemas.ts'
import { DetailedHtmlAttributesSchema, ElementAttributeListSchema } from './template.schemas.ts'
import type { Children, CustomElementTag, HtmlRegistry, TemplateObject } from './template.types.ts'

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

/**
 * @internal
 * Error thrown when a `$styleRef` / `$bind` is encountered without a registry.
 */
class MissingRegistryError extends Error implements Error {
  override name = 'missing_registry'
}

/**
 * @internal
 * Error thrown when a `$styleRef` cannot be found in the registry.
 */
class UnresolvedStyleRefError extends Error implements Error {
  override name = 'unresolved_style_ref'
}

/**
 * @internal
 * Error thrown when a `$bind` path cannot be resolved from registry.data.
 */
class UnresolvedBindError extends Error implements Error {
  override name = 'unresolved_bind'
}

/**
 * @internal
 * Error thrown when a `$bind` appears in an invalid position.
 */
class InvalidBindPositionError extends Error implements Error {
  override name = 'invalid_bind_position'
}

/**
 * @internal
 * Error thrown when a `$styleRef` appears outside the `style[]` array.
 */
class InvalidStyleRefPositionError extends Error implements Error {
  override name = 'invalid_style_ref_position'
}

export type CreateFragment = (children: Children) => TemplateObject

export const fragment: CreateFragment = (_children) => {
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

/** @internal Type signature for `h`. */
export type CreateTemplate = (tag: string, attrs?: Record<string, unknown>, registry?: HtmlRegistry) => TemplateObject

/**
 * @internal
 * Local type for safe destructuring — mirrors the Plaited-specific
 * properties handled by `h()` before attribute serialization.
 */
type PlaitedAttrs = {
  children?: Children | Bind
  stylesheets?: string[]
  style?: CSSProperties | StyleRef[]
  [P_TRIGGER]?: Record<string, string>
  [P_SCALE]?: keyof typeof SCALE
  [P_FORM]?: string
  class?: string
  classNames?: string[]
  for?: string
  shadowrootmode?: 'open' | 'closed'
  [key: string]: unknown
}

/**
 * @internal
 * Resolve a dotted path from a data context (e.g. 'customer.id' → data.customer.id).
 * Returns `undefined` if the path does not exist.
 */
const resolveDataPath = (data: Record<string, unknown>, path: string): unknown => {
  let current: unknown = data
  for (const segment of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * @internal
 * Creates Plaited template objects from JSX-like calls.
 * Core template factory with security-first design and style management.
 *
 * @param _tag - HTML/SVG tag name, custom element tag, or FunctionTemplate
 * @param attrs - Element attributes including children
 * @param registry - Optional registry for resolving `$styleRef` / `$bind` refs
 * @returns TemplateObject with HTML, stylesheets, and identifier
 *
 * @throws {ScriptPolicyError} When `<script>` does not use a site-root JavaScript `src`
 * @throws {EventHandlerAttributeError} When `on*` attributes are used (use p-trigger instead)
 * @throws {InvalidAttributeTypeError} When non-primitive attribute values provided
 * @throws {InvalidCustomElementTagError} When a hyphenated tag is not a valid custom element tag
 * @throws {InvalidAttributeError} When attribute values fail per-tag schema validation
 * @throws {MissingRegistryError} When a $styleRef/$bind is encountered without a registry
 * @throws {UnresolvedStyleRefError} When a $styleRef cannot be found in the registry
 * @throws {UnresolvedBindError} When a $bind path cannot be resolved
 *
 * @remarks
 * Security features:
 * - Automatic HTML escaping
 * - No inline event handlers
 * - External site-root script bootstrap only
 *
 * @see {@link h} for JSX factory alias
 * @see {@link fragment} for grouping elements
 */
export const h: CreateTemplate = (_tag, attrs = {}, registry?) => {
  const safeAttrs = attrs as PlaitedAttrs
  const {
    children: _children,
    stylesheets: _stylesheets,
    style,
    [P_TRIGGER]: pTrigger,
    [P_SCALE]: pScale = 'rel',
    [P_FORM]: pForm,
    class: cls,
    classNames,
    for: htmlFor,
    ...attributes
  } = safeAttrs

  let stylesheets = _stylesheets ?? []
  const resolvedClassNames = new Set(classNames)

  // ── Resolve $styleRef (style[] array of StyleRef) ─────────────────
  let resolvedStyle: CSSProperties | undefined
  if (Array.isArray(style)) {
    // style is an array → treat as StyleRef[]
    // First, validate no $bind refs in style[] (position check independent of registry)
    for (const ref of style) {
      if (ref && typeof ref === 'object') {
        const refObj = ref as Record<string, unknown>
        if ('$bind' in refObj) {
          throw new InvalidBindPositionError('`$bind` is not legal in the `style[]` array')
        }
      }
    }
    if (!registry) throw new MissingRegistryError('$styleRef encountered without a registry')
    if (!registry.styles) throw new MissingRegistryError('$styleRef encountered without registry.styles')
    for (const ref of style) {
      if (!ref || typeof ref !== 'object') {
        throw new InvalidAttributeTypeError('Expected $styleRef object in style array')
      }
      const refObj = ref as Record<string, unknown>
      if (!('$styleRef' in refObj)) {
        throw new InvalidAttributeTypeError('Expected $styleRef object in style array')
      }
      const styleRef = ref as StyleRef
      const resolved = registry.styles.get(styleRef.$styleRef)
      if (!resolved) throw new UnresolvedStyleRefError(`Unresolved style ref: ${styleRef.$styleRef}`)
      for (const cn of resolved.classNames) resolvedClassNames.add(cn)
      stylesheets.push(...resolved.stylesheets)
    }
  } else if (style) {
    resolvedStyle = style as CSSProperties
  }

  // ── Resolve $bind in attrs values ────────────────────────────────
  const resolveAttr = (val: unknown, attrKey: string): unknown => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>
      // $styleRef is only legal in the style[] array
      if ('$styleRef' in obj) {
        throw new InvalidStyleRefPositionError(
          `\`$styleRef\` is only legal in the \`style[]\` array, found as \`${attrKey}\``,
        )
      }
      if ('$bind' in obj) {
        if (!registry?.data) throw new MissingRegistryError('$bind encountered without a registry')
        const bindVal = val as Bind
        const resolved = resolveDataPath(registry.data, bindVal.$bind)
        if (resolved === undefined) {
          throw new UnresolvedBindError(`Unresolved bind path: ${bindVal.$bind}`)
        }
        return resolved
      }
    }
    return val
  }

  const normalizedAttributes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(attributes)) {
    normalizedAttributes[key.toLowerCase()] = resolveAttr(value, key)
  }

  // ── Resolve $bind in children/text ────────────────────────────────
  let resolvedChildren = _children
  if (_children && typeof _children === 'object' && '$bind' in (_children as Record<string, unknown>)) {
    resolvedChildren = resolveAttr(_children, 'children') as Children | undefined
  }

  const tag = htmlEscape(_tag.trim().toLowerCase())
  if (tag.includes('-') && !isCustomElementTag(tag)) {
    throw new InvalidCustomElementTagError(`Invalid custom element tag: ${tag}`)
  }

  if (tag === 'script') {
    if (resolvedChildren !== undefined) {
      throw new ScriptPolicyError('Script tags cannot contain inline content')
    }
    const src = normalizedAttributes.src
    if (typeof src !== 'string' || !SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test(src)) {
      throw new ScriptPolicyError('Script tags require a site-root JavaScript src')
    }
  }

  // ── Schema validation on resolved attrs ────────────────────────────
  const resolvedAttrs: Record<string, unknown> = {}
  if (resolvedChildren !== undefined) resolvedAttrs.children = resolvedChildren
  if (pTrigger) resolvedAttrs[P_TRIGGER] = pTrigger
  if (pScale) resolvedAttrs[P_SCALE] = pScale
  if (cls) resolvedAttrs.class = cls
  if (classNames) resolvedAttrs.classNames = classNames
  // Include normalized attrs minus keys handled by destructuring above.
  const platedAttrKeys = new Set([
    'children',
    'style',
    'stylesheets',
    P_TRIGGER,
    P_SCALE,
    P_FORM,
    'class',
    'classnames',
    'for',
    'shadowrootmode',
  ])
  for (const [key, value] of Object.entries(normalizedAttributes)) {
    if (!platedAttrKeys.has(key)) {
      resolvedAttrs[key] = value
    }
  }

  const tagSchema =
    tag in ElementAttributeListSchema.shape
      ? ElementAttributeListSchema.shape[tag as keyof typeof ElementAttributeListSchema.shape]
      : DetailedHtmlAttributesSchema
  const validationResult = tagSchema.safeParse(resolvedAttrs)
  if (!validationResult.success) {
    const issues = validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new InvalidAttributeError(`Invalid attributes for <${tag}>: ${issues}`)
  }

  const start = [`<${tag} `]
  // Handle JavaScript-reserved words commonly used in HTML.
  if (htmlFor) start.push(`for="${htmlEscape(`${htmlFor}`)}" `)
  cls && resolvedClassNames.add(htmlEscape(cls))
  if (resolvedClassNames.size) start.push(`class="${[...resolvedClassNames].join(' ')}" `)
  if (pTrigger) {
    const value = Object.entries(pTrigger)
      .map<string>(([ev, req]) => `${ev}:${req}`)
      .join(' ')
    start.push(`${P_TRIGGER}="${htmlEscape(value)}" `)
  }
  if (resolvedStyle) {
    const value = Object.entries(resolvedStyle)
      // Convert camelCase style props into dash-case unless they are CSS variables.
      .map<string>(([prop, val]) => `${prop.startsWith('--') ? prop : kebabCase(prop)}:${val};`)
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
  const children = Array.isArray(resolvedChildren) ? resolvedChildren.flat() : [resolvedChildren]
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
