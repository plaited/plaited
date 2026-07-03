import {
  BOOLEAN_ATTRS,
  type Child,
  CLASS,
  type DetailedHTMLAttributes,
  type ElementNode,
  ElementNodeSchema,
  FLAT_NODE_KINDS,
  P_SCALE,
  P_TRIGGER,
  PRIMITIVES,
  type Ref,
  RefSchema,
  SCALE,
  SCALE_RANK,
  STYLE,
  STYLES,
  TEMPLATE_OBJECT_IDENTIFIER,
  type TemplateObject,
  TemplateObjectSchema,
  VALID_PRIMITIVE_CHILDREN,
  VOID_TAGS,
} from '../shared.ts'
import { htmlEscape, isTypeOf, trueTypeOf } from '../utils.ts'

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

const DESTRUCTURED_ATTRIBUTES = new Set([CLASS, P_SCALE, P_TRIGGER, STYLE, STYLES])

/**
 * Matches site-root JavaScript module paths accepted by bootstrap script tags
 * and controller module imports.
 *
 * @public
 */
const SITE_ROOT_JAVASCRIPT_PATH_PATTERN = /^\/(?!\/)[^\s\\?#]+\.js(?:[?#][^\s\\]*)?$/

type QueryReturn = string | number | ElementNode
export type Query = (arg: Ref) => Promise<QueryReturn> | QueryReturn

export class Renderer {
  constructor({ query }: { query: Query }) {
    // Todo Resolver callback fo here it can be called byt any of our private methods.
    // The render buulds up the #templateObject
    this.#query = query
  }
  #query: Query
  #templateObject: TemplateObject = {
    html: [],
    scale: SCALE.rel,
    stylesheets: [],
    $: TEMPLATE_OBJECT_IDENTIFIER,
  }

  async #class() {}
  async #host() {}
  async #root() {}
  async #top() {}
  async #keyframe() {}
  async #token() {}
  async #style() {}
  async #template() {}
  async #switch() {}
  async #path() {}
}

const useRenderer = ({ query }: { query: Query }) => {
  return async ({ tag, attributes = {}, children = [] }: ElementNode): Promise<TemplateObject> => {
    const {
      [CLASS]: cls,
      [P_SCALE]: pScale = SCALE.rel,
      [P_TRIGGER]: pTrigger,
      [STYLE]: style,
      [STYLES]: styles,
      ...attrs
    } = attributes
    const normalizedAttributes: DetailedHTMLAttributes = {}
    for (const [key, value] of Object.entries(attrs)) {
      const normalizedKey = key.toLowerCase()
      if (DESTRUCTURED_ATTRIBUTES.has(normalizedKey)) continue
      normalizedAttributes[normalizedKey] = value
    }

    if (tag === 'script') {
      if (children !== undefined) {
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
    start.push('>')
    const end: string[] = []
    const length = children.length
    let highestChildScale: keyof typeof SCALE = SCALE.rel
    for (let i = 0; i < length; i++) {
      const child = children[i]
      const ref = RefSchema.safeParse(child)
      if (ref.success) {
        const result = await query(ref.data)
        const node = ElementNodeSchema.safeParse(result)
        if (node.success) {
          const render = useRenderer({ query })
          const tpl = await render(node.data)
          end.push(...tpl.html)
          stylesheets.unshift(...tpl.stylesheets)
          const { scale } = tpl
          if (scale !== SCALE.rel) {
            if (pScale === SCALE.rel) {
              if (
                (SCALE_RANK as Record<string, number>)[scale]! >
                (SCALE_RANK as Record<string, number>)[highestChildScale]!
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
        } else {
          end.push(htmlEscape(`${result}`))
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
}
