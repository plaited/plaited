import type { BoundElement, SelectorMatch } from './plaited.types'
import { assignHelpers, getBindings } from './assign-helpers'
import { P_TARGET } from '../jsx/jsx.constants.js'

/**
 * @description A hook for creating dynamic content from an HTML `<template>` element within a Plaited component.
 * It provides a factory function that clones the template's content and allows targeted updates using data.
 * This is particularly useful for rendering lists or repeating structures efficiently.
 *
 * @template T - The type of the data object that will be passed to the factory function for each instance.
 * @param {BoundElement<HTMLTemplateElement>} el - The Plaited-bound `<template>` element containing the structure to be cloned.
 * @param {(factory: ($: <E extends Element = Element>(target: string, match?: SelectorMatch) => BoundElement<E>[], data: T) => void) => (data: T) => DocumentFragment} callback
 *   A function that receives the query function (`$`) and the data (`data`) for a specific instance.
 *   - The `$` function is used *within* the callback to select elements marked with `p-target` inside the *cloned* template content.
 *     It returns an array of `BoundElement` instances, allowing manipulation (e.g., setting text content, attributes).
 *   - The `data` object (`T`) provides the dynamic values to populate the cloned template instance.
 * @returns {(data: T) => DocumentFragment} A factory function. When called with data (`T`), this function:
 *   1. Clones the content of the original `<template>` element (`el`).
 *   2. Executes the provided `callback` function, passing the query function (`$`) scoped to the clone and the `data`.
 *   3. Returns the populated `DocumentFragment` ready to be inserted into the DOM.
 *
 * @example
 * ```typescript
 * // Inside a Plaited component's bProgram
 * import { useTemplate, h } from 'plaited';
 *
 * // Assume this template exists in the shadow DOM
 * // <template p-target="item-template">
 * //   <li p-target="item-text"></li>
 * // </template>
 *
 * bProgram({ $, trigger }) {
 *   const [templateEl] = $<HTMLTemplateElement>('item-template');
 *   const [listEl] = $('ul'); // Assume <ul> exists
 *
 *   // Create the item factory using the template
 *   const createListItem = useTemplate<string>(templateEl, ($, textContent) => {
 *     const [itemTextEl] = $<HTMLLIElement>('item-text'); // Query inside the clone
 *     itemTextEl.render(textContent); // Populate the clone
 *   });
 *
 *   return {
 *     addItems(items: string[]) {
 *       const fragments = items.map(item => createListItem(item)); // Create fragments for each item
 *       listEl.render(...fragments); // Render all fragments into the list
 *     },
 *     // ... other handlers
 *   };
 * }
 * ```
 *
 * @remarks
 * - The original `<template>` element (`el`) must have the `p-target` attribute to be selected.
 * - Elements *inside* the `<template>` that need to be updated must also have `p-target` attributes.
 * - The `$` function provided to the callback is specifically bound to the cloned fragment for each invocation of the factory function.
 * - This hook leverages `cloneNode(true)` for efficient template instantiation.
 * - It automatically binds Plaited helper methods (`render`, `insert`, `attr`, etc.) to the queried elements within the clone.
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
  const content = el.content
  const bindings = getBindings(el.getRootNode() as ShadowRoot)
  return (data: T) => {
    const clone = content.cloneNode(true) as DocumentFragment
    callback(
      <E extends Element = Element>(target: string, match: SelectorMatch = '=') =>
        assignHelpers<E>(bindings, clone.querySelectorAll<E>(`[${P_TARGET}${match}"${target}"]`)),
      data,
    )
    return clone
  }
}
