/**
 * @internal
 * @module use-template
 *
 * Purpose: Efficient template cloning and data binding for dynamic content generation
 * Architecture: Factory pattern that creates pre-bound template instances with helper methods
 * Dependencies: assign-helpers for DOM manipulation, jsx.constants for attribute names
 * Consumers: Components needing to render lists, tables, or repeated UI patterns
 *
 * Maintainer Notes:
 * - This module enables efficient rendering of repeated content without JSX overhead
 * - Template cloning is much faster than creating elements from scratch
 * - Bindings are cached at shadow root level for performance
 * - The $ function provides scoped querying within the cloned fragment
 * - Helper methods are assigned lazily only to queried elements
 * - Templates must be <template> elements with content property
 *
 * Common modification scenarios:
 * - Adding template validation: Check for required p-target attributes
 * - Supporting async data loading: Make callback async
 * - Template caching: Store compiled templates for reuse
 * - Batch rendering: Accept array of data items
 *
 * Performance considerations:
 * - Template cloning is O(n) where n is node count
 * - Bindings lookup is O(1) via shadow root reference
 * - querySelector is scoped to fragment, not entire DOM
 * - Helper assignment happens only for accessed elements
 *
 * Known limitations:
 * - No built-in diffing or reconciliation
 * - Templates must be in same shadow root
 * - Cannot update existing elements, only create new
 * - No automatic cleanup of event listeners
 */
import type { BoundElement, SelectorMatch } from './plaited.types'
import { assignHelpers, getBindings } from './assign-helpers.js'
import { P_TARGET } from './jsx.constants.js'

/**
 * Creates a template factory function for efficient dynamic content generation in Plaited components.
 * Enables reusable template patterns with dynamic data binding and automatic style management.
 *
 * @template T - Type of data used to populate each template instance
 * @param el - BoundElement of type HTMLTemplateElement
 * @param callback - Function to populate the cloned template with data
 * @returns Factory function that creates populated DocumentFragments
 *
 * @example
 * Dynamic List Component
 * ```tsx
 * const ListComponent = bElement({
 *   tag: 'list-component',
 *   shadowDom: (
 *     <div>
 *       <template p-target="item-template">
 *         <div {...styles.item}>
 *           <h3 p-target="title" {...styles.title} />
 *           <p p-target="description" {...styles.description} />
 *           <button
 *             p-target="delete-btn"
 *             p-trigger={{ click: 'DELETE_ITEM' }}
 *             {...styles.button}
 *           >
 *             Delete
 *           </button>
 *         </div>
 *       </template>
 *       <div p-target="list" {...styles.list} />
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [template] = $<HTMLTemplateElement>('item-template');
 *     const [list] = $('list');
 *
 *     // Create template factory
 *     const createItem = useTemplate<{
 *       id: string;
 *       title: string;
 *       description: string;
 *     }>(template, ($, data) => {
 *       const [title] = $('title');
 *       const [desc] = $('description');
 *       const [deleteBtn] = $('delete-btn');
 *
 *       title.render(data.title);
 *       desc.render(data.description);
 *       deleteBtn.attr('data-id', data.id);
 *     });
 *
 *     return {
 *       ADD_ITEMS(items) {
 *         list.render(...items.map(createItem));
 *       },
 *
 *       DELETE_ITEM({ currentTarget }) {
 *         const itemId = currentTarget.getAttribute('data-id');
 *         const itemEl = currentTarget.closest(`[data-id="${itemId}"]`);
 *         itemEl?.remove();
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example
 * Table Row Template
 * ```tsx
 * const DataTable = bElement({
 *   tag: 'data-table',
 *   shadowDom: (
 *     <div>
 *       <template p-target="row-template">
 *         <tr {...styles.row}>
 *           <td p-target="name" {...styles.cell} />
 *           <td p-target="email" {...styles.cell} />
 *           <td p-target="status" {...styles.cell} />
 *         </tr>
 *       </template>
 *       <table {...styles.table}>
 *         <thead>
 *           <tr>
 *             <th>Name</th>
 *             <th>Email</th>
 *             <th>Status</th>
 *           </tr>
 *         </thead>
 *         <tbody p-target="tbody" />
 *       </table>
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [template] = $<HTMLTemplateElement>('row-template');
 *     const [tbody] = $('tbody');
 *
 *     const createRow = useTemplate<{
 *       name: string;
 *       email: string;
 *       status: 'active' | 'inactive';
 *     }>(template, ($, data) => {
 *       $('name')[0].render(data.name);
 *       $('email')[0].render(data.email);
 *       $('status')[0].render(
 *         <span {...styles[data.status]}>
 *           {data.status}
 *         </span>
 *       );
 *     });
 *
 *     return {
 *       UPDATE_DATA(data) {
 *         tbody.render(...data.map(createRow));
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * Key Features:
 * - Efficient template cloning
 * - Type-safe data binding
 * - Automatic style management
 * - Scoped element querying
 * - Built-in helper methods
 *
 * Usage Notes:
 * 1. Template Structure
 *    - Template must have p-target attribute
 *    - Child elements needing updates need p-target
 *    - Can include styles and event triggers
 *
 * 2. Data Binding
 *    - Use TypeScript generics for type safety
 *    - Access elements via $ function
 *    - Helper methods (render, insert, attr) available
 *
 * 3. Performance
 *    - Templates are cloned, not recreated
 *    - Styles are automatically managed
 *    - Event delegates are preserved
 *
 * 4. Best Practices
 *    - Keep templates focused and minimal
 *    - Use TypeScript for data typing
 *    - Leverage CSS modules for styles
 */
export const useTemplate = <T>(
  el: BoundElement<HTMLTemplateElement>,
  callback: (
    $: <E extends Element = Element>(
      target: string,
      /** This options enables querySelectorAll and modified the attribute selector for p-target{@default {all: false, mod: "=" } } {@link https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors#syntax}*/
      match?: SelectorMatch,
    ) => BoundElement<E>[],
    data: T,
  ) => void,
) => {
  /**
   * @internal
   * Extract template content once for reuse.
   * DocumentFragment reference is stable across clones.
   */
  const content = el.content

  /**
   * @internal
   * Get bindings from shadow root for helper method attachment.
   * Cached at shadow root level for all templates in component.
   */
  const bindings = getBindings(el.getRootNode() as ShadowRoot)

  /**
   * @internal
   * Return factory function that creates populated instances.
   * Closure captures content and bindings for efficiency.
   */
  return (data: T) => {
    /**
     * @internal
     * Deep clone template content including all child nodes.
     * cloneNode(true) is native and highly optimized.
     */
    const clone = content.cloneNode(true) as DocumentFragment

    /**
     * @internal
     * Execute user callback with scoped $ function and data.
     * $ function queries only within cloned fragment for isolation.
     */
    callback(
      /**
       * @internal
       * Scoped query function for finding elements within clone.
       * Assigns helper methods to results before returning.
       * Match parameter allows flexible attribute selectors.
       */
      <E extends Element = Element>(target: string, match: SelectorMatch = '=') =>
        assignHelpers<E>(bindings, clone.querySelectorAll<E>(`[${P_TARGET}${match}"${target}"]`)),
      data,
    )

    /**
     * @internal
     * Return populated fragment ready for DOM insertion.
     * Fragment is consumed when inserted, becoming empty.
     */
    return clone
  }
}
