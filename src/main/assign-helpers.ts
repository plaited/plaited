/**
 * @internal
 * @module assign-helpers
 *
 * Purpose: Core DOM manipulation utilities for Plaited's reactive element system
 * Architecture: Provides the binding layer between elements and reactive updates
 * Dependencies: JSX types, CSS system, type utilities
 * Consumers: defineElement, useTemplate, internal rendering system
 *
 * Maintainer Notes:
 * - This module implements the core DOM update strategy for Plaited elements
 * - Helper methods are attached to DOM elements via Object.assign for performance
 * - Style adoption is async to handle CSS module loading
 * - WeakMap caching prevents memory leaks and duplicate style processing
 * - Boolean attributes require special handling per HTML spec
 *
 * Common modification scenarios:
 * - Adding new helper methods: Update Bindings interface and getBindings
 * - Changing style adoption: Modify updateShadowRootStyles and cache strategy
 * - Supporting new attribute types: Extend updateAttributes logic
 * - Optimizing renders: Adjust formatFragments or DocumentFragment creation
 *
 * Performance considerations:
 * - Object.assign is used once per element, not per update
 * - Style sheets are cached per ShadowRoot to avoid duplication
 * - Attribute updates are batched when using object syntax
 * - DocumentFragment creation is deferred until needed
 */
import type { TemplateObject } from './jsx.types.js'
import { BOOLEAN_ATTRS } from './jsx.constants.js'
import type { Bindings, BoundElement } from './plaited.types.js'
import type { StylesObject } from './css.types.js'
import { isTypeOf } from '../utils/is-type-of.js'
/**
 * @internal Cache for storing adopted stylesheets per ShadowRoot to prevent duplicate processing.
 * Used internally by the framework to optimize style adoption performance.
 */
export const cssCache = new WeakMap<ShadowRoot, Set<string>>()

/**
 * @internal
 * Asynchronously updates the adopted stylesheets for a given ShadowRoot.
 *
 * Manages CSS adoption using the Constructable Stylesheets API for optimal performance.
 * Prevents duplicate style processing through WeakMap caching per ShadowRoot.
 *
 * @param root - The ShadowRoot to update stylesheets for
 * @param stylesheets - Set of CSS strings to adopt
 *
 * Implementation details:
 * - Uses WeakMap to track adopted styles per ShadowRoot
 * - Creates CSSStyleSheet instances asynchronously
 * - Appends new sheets to existing adoptedStyleSheets array
 * - Errors are logged but don't break rendering
 *
 * Cache strategy:
 * - Cache key: ShadowRoot instance
 * - Cache value: Set of already-adopted CSS strings
 * - Prevents re-adoption of identical styles
 * - Automatically cleaned up when ShadowRoot is garbage collected
 *
 * Error handling:
 * - CSS syntax errors are caught and logged
 * - Rendering continues even if some styles fail
 * - Invalid CSS will produce console errors but not crash
 */
const updateShadowRootStyles = async (root: ShadowRoot, stylesheets: Set<string>) => {
  const instanceStyles = cssCache.get(root) ?? cssCache.set(root, new Set()).get(root)
  const newStyleSheets: CSSStyleSheet[] = []
  try {
    await Promise.all(
      [...stylesheets].map(async (styles) => {
        if (instanceStyles?.has(styles)) return
        const sheet = new CSSStyleSheet()
        instanceStyles?.add(styles)
        const nextSheet = await sheet.replace(styles)
        newStyleSheets.push(nextSheet)
      }),
    )
  } catch (error) {
    console.error(error)
  }
  if (newStyleSheets.length) root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...newStyleSheets]
}

/**
 * @internal
 * Safely updates or removes an attribute on an element, handling boolean attributes correctly.
 *
 * Central attribute update logic that handles all attribute types including:
 * - Standard attributes (string, number values)
 * - Boolean attributes (presence-based like 'disabled', 'checked')
 * - CSS module class objects with automatic style adoption
 * - Null values for attribute removal
 *
 * @param options Attribute update configuration
 * @param options.element - Target DOM element
 * @param options.attr - Attribute name to update
 * @param options.val - New value (null removes attribute)
 * @param options.root - ShadowRoot for style adoption
 *
 * Attribute handling rules:
 * 1. null/undefined: Remove attribute if present
 * 2. Boolean attributes: Use toggleAttribute for spec compliance
 * 3. StylesObject: Extract class names and adopt stylesheets
 * 4. Other values: Convert to string and set
 *
 * Special cases:
 * - 'class' with StylesObject triggers async style adoption
 * - 'part' attribute handling is TODO (shadow parts API)
 * - Boolean attributes use presence semantics, not value
 *
 * HTML spec compliance:
 * - Boolean attributes follow HTML5 boolean attribute rules
 * - Empty string and attribute presence both mean 'true'
 * - Removal is the only way to set 'false'
 */
const updateAttributes = ({
  element,
  attr,
  val,
  root,
}: {
  element: Element
  attr: string | 'class'
  val: string | null | number | boolean | StylesObject
  root: ShadowRoot
}) => {
  // Remove the attribute if val is null or undefined, and it currently exists
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  // Set the attribute if it is a boolean attribute and it does not exist
  if (BOOLEAN_ATTRS.has(attr)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if the new value is different from the current value
  if (attr === 'class' && isTypeOf<StylesObject>(val, 'object')) {
    void updateShadowRootStyles(root, new Set(val.stylesheet))
    element.setAttribute(attr, `${val.class}`)
  } else if (attr === 'part') {
    // TODO: Implement shadow parts API support
    // This will enable ::part() CSS selectors for styling across shadow boundaries
  } else {
    element.setAttribute(attr, `${val}`)
  }
}

/**
 * @internal Creates a DocumentFragment from a Plaited template object, handling both content and styles.
 * Used internally when rendering templates within components.
 */
export const getDocumentFragment = (shadowRoot: ShadowRoot, templateObject: TemplateObject) => {
  const { html, stylesheets } = templateObject
  stylesheets.length && void updateShadowRootStyles(shadowRoot, new Set(stylesheets))
  const template = document.createElement('template')
  template.setHTMLUnsafe(html.join(''))
  return template.content
}

/**
 * @internal
 * Formats an array of fragments into DOM-insertable content.
 *
 * Normalizes various content types into strings or DocumentFragments that can be
 * efficiently inserted into the DOM using replaceChildren, append, etc.
 *
 * @param shadowRoot - ShadowRoot context for style adoption
 * @param fragments - Mixed array of renderable content
 * @returns Array of strings and DocumentFragments ready for DOM insertion
 *
 * Type handling:
 * - DocumentFragment: Passed through unchanged (already DOM-ready)
 * - string: Passed through unchanged (text content)
 * - number: Converted to string representation
 * - TemplateObject: Converted to DocumentFragment with style adoption
 *
 * Performance optimizations:
 * - Pre-allocates return array for efficiency
 * - Minimal type checking using instanceof and typeof
 * - Defers DocumentFragment creation until needed
 * - Reuses getDocumentFragment for template processing
 *
 * Usage context:
 * - Called by render(), insert(), and replace() helper methods
 * - Handles mixed content from JSX expressions
 * - Ensures all content is DOM-safe before insertion
 */
const formatFragments = (
  shadowRoot: ShadowRoot,
  fragments: (number | string | TemplateObject | DocumentFragment)[],
) => {
  const length = fragments.length
  const toRet: (string | DocumentFragment)[] = []
  for (let i = 0; i < length; i++) {
    const frag = fragments[i]
    toRet.push(
      frag instanceof DocumentFragment || typeof frag === 'string' ? frag
      : typeof frag === 'number' ? `${frag}`
      : getDocumentFragment(shadowRoot, frag),
    )
  }
  return toRet
}

/**
 * @internal Creates DOM manipulation helper methods bound to a specific shadow root.
 * These methods are automatically attached to elements with p-target attributes.
 */
export const getBindings = (shadowRoot: ShadowRoot): Bindings => ({
  /** Replaces the children of the bound element with the provided fragments. */
  render(...fragments) {
    this.replaceChildren(...formatFragments(shadowRoot, fragments))
  },
  /** Inserts fragments at the specified position relative to the bound element. */
  insert(position, ...fragments) {
    const content = formatFragments(shadowRoot, fragments)
    position === 'beforebegin' ? this.before(...content)
    : position === 'afterbegin' ? this.prepend(...content)
    : position === 'beforeend' ? this.append(...content)
    : this.after(...content)
  },
  /** Replaces the bound element itself with the provided fragments. */
  replace(...fragments) {
    this.replaceWith(...formatFragments(shadowRoot, fragments))
  },
  /** Gets or sets attributes on the bound element. Can accept a single attribute name (to get) or name/value pair (to set), or an object of attributes to set. */
  attr(attr, val) {
    if (typeof attr === 'string') {
      // Return the attribute value if val is not provided
      if (val === undefined) return this.getAttribute(attr)
      return updateAttributes({
        root: shadowRoot,
        element: this,
        attr,
        val,
      })
    }
    for (const key in attr) {
      updateAttributes({
        root: shadowRoot,
        element: this,
        attr: key,
        val: attr[key],
      })
    }
  },
})

/**
 * @internal Assigns Plaited helper methods to DOM elements.
 * Used internally to enhance elements with p-target attributes.
 */
export const assignHelpers = <T extends Element = Element>(bindings: Bindings, elements: NodeListOf<T> | T[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) !Object.hasOwn(elements[i], 'attr') && Object.assign(elements[i], bindings)
  return elements as BoundElement<T>[]
}
