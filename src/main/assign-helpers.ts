import type { TemplateObject } from '../jsx/jsx.types.js'
import { BOOLEAN_ATTRS } from '../jsx/jsx.constants.js'
import type { Bindings, BoundElement } from './plaited.types.js'

/**
 * Cache for storing adopted stylesheets per ShadowRoot to prevent duplicate processing.
 * Used internally by the framework to optimize style adoption performance.
 *
 * @internal
 * @example
 * ```tsx
 * // Framework internal use:
 * const ComponentWithStyles = defineElement({
 *   tag: 'styled-component',
 *   shadowDom: (
 *     <div {...styles.container}>
 *       <h1 {...styles.title}>Title</h1>
 *     </div>
 *   ),
 *   bProgram({ $, root }) {
 *     // Styles are automatically cached per instance
 *     // Subsequent renders reuse cached stylesheets
 *   }
 * });
 * ```
 */
export const cssCache = new WeakMap<ShadowRoot, Set<string>>()

/** @internal Asynchronously updates the adopted stylesheets for a given ShadowRoot. */
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

/** @internal Safely updates or removes an attribute on an element, handling boolean attributes correctly. */
const updateAttributes = (element: Element, attr: string, val: string | null | number | boolean) => {
  // Remove the attribute if val is null or undefined, and it currently exists
  if (val === null && element.hasAttribute(attr)) return element.removeAttribute(attr)
  // Set the attribute if it is a boolean attribute and it does not exist
  if (BOOLEAN_ATTRS.has(attr)) {
    !element.hasAttribute(attr) && element.toggleAttribute(attr, true)
    return
  }
  // Set the attribute if the new value is different from the current value
  element.setAttribute(attr, `${val}`)
}

/**
 * Creates a DocumentFragment from a Plaited template object, handling both content and styles.
 * Used internally when rendering templates within components.
 *
 * @param shadowRoot - The shadow root where styles will be adopted
 * @param templateObject - Plaited template object containing HTML and stylesheets
 * @returns A document fragment with the template content
 *
 * @example
 * ```tsx
 * const DynamicContent = defineElement({
 *   tag: 'dynamic-content',
 *   shadowDom: <div p-target="container" />,
 *   bProgram({ $, root }) {
 *     const [container] = $('container');
 *
 *     return {
 *       UPDATE_CONTENT({ content }) {
 *         // The framework automatically handles style adoption
 *         // when using template objects with render/insert/replace
 *         container.render(
 *           <div {...styles.dynamicContent}>
 *             {content}
 *           </div>
 *         );
 *       }
 *     };
 *   }
 * });
 * ```
 */
export const getDocumentFragment = (shadowRoot: ShadowRoot, templateObject: TemplateObject) => {
  const { html, stylesheets } = templateObject
  stylesheets.length && void updateShadowRootStyles(shadowRoot, new Set(stylesheets))
  const template = document.createElement('template')
  template.setHTMLUnsafe(html.join(''))
  return template.content
}

/** @internal Formats an array of fragments (strings, numbers, TemplateObjects, DocumentFragments) into an array of strings or DocumentFragments, ready for DOM insertion. */
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
 * Creates DOM manipulation helper methods bound to a specific shadow root.
 * These methods are automatically attached to elements with p-target attributes.
 *
 * @param shadowRoot - The shadow root context for DOM operations
 * @returns Object containing helper methods (render, insert, replace, attr)
 *
 * @example
 * ```tsx
 * const TodoList = defineElement({
 *   tag: 'todo-list',
 *   shadowDom: (
 *     <div>
 *       <ul p-target="list">
 *         <li p-target="placeholder">No items yet</li>
 *       </ul>
 *       <button
 *         p-target="addBtn"
 *         p-trigger={{ click: 'ADD_ITEM' }}
 *       >
 *         Add Item
 *       </button>
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [list] = $('list');
 *     const [placeholder] = $('placeholder');
 *     let items = 0;
 *
 *     return {
 *       ADD_ITEM() {
 *         if (items === 0) {
 *           placeholder.remove();
 *         }
 *
 *         // Helper methods support JSX and handle style adoption
 *         list.insert('beforeend',
 *           <li {...styles.item}>
 *             Item {++items}
 *             <button
 *               p-target="deleteBtn"
 *               p-trigger={{ click: 'DELETE_ITEM' }}
 *               {...styles.deleteBtn}
 *             >
 *               ×
 *             </button>
 *           </li>
 *         );
 *       },
 *
 *       DELETE_ITEM({ currentTarget }) {
 *         currentTarget.closest('li').remove();
 *         if (--items === 0) {
 *           list.render(<li p-target="placeholder">No items yet</li>);
 *         }
 *       }
 *     };
 *   }
 * });
 * ```
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
      return updateAttributes(this, attr, val)
    }
    for (const key in attr) {
      updateAttributes(this, key, attr[key])
    }
  },
})

/**
 * Assigns Plaited helper methods to DOM elements.
 * Used internally to enhance elements with p-target attributes.
 *
 * @template T Element type being enhanced
 * @param bindings Helper methods to attach
 * @param elements Elements to enhance
 * @returns Enhanced elements array
 *
 * @example
 * ```tsx
 * const DynamicElement = defineElement({
 *   tag: 'dynamic-element',
 *   shadowDom: <div p-target="root" />,
 *   bProgram({ $, root }) {
 *     const [container] = $('root');
 *
 *     return {
 *       ADD_DYNAMIC_CONTENT() {
 *         // When new elements with p-target are added,
 *         // they automatically get helper methods
 *         container.render(
 *           <div>
 *             <span p-target="text">Dynamic text</span>
 *             <button
 *               p-target="btn"
 *               p-trigger={{ click: 'UPDATE' }}
 *             >
 *               Update
 *             </button>
 *           </div>
 *         );
 *       },
 *
 *       UPDATE() {
 *         // Can immediately use helper methods on new elements
 *         const [text] = $('text');
 *         text.render('Updated content');
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * - Helper methods are only added if they don't already exist
 * - Methods are bound to the element's context
 * - Handles style adoption automatically
 * - TypeScript typing is preserved
 */
export const assignHelpers = <T extends Element = Element>(bindings: Bindings, elements: NodeListOf<T> | T[]) => {
  const length = elements.length
  for (let i = 0; i < length; i++) !('attr' in elements[i]) && Object.assign(elements[i], bindings)
  return elements as BoundElement<T>[]
}
