/**
 * Plaited Core Module
 *
 * The main entry point for the Plaited framework, providing essential APIs for creating
 * web components, managing their lifecycle, and building reactive user interfaces.
 *
 * @packageDocumentation
 *
 * @example
 * Basic Component
 * ```tsx
 * import { defineElement } from 'plaited'
 *
 * const Counter = defineElement({
 *   tag: 'my-counter',
 *   shadowDom: (
 *     <div>
 *       <button p-target="decBtn" p-trigger={{ click: 'DECREMENT' }}>-</button>
 *       <span p-target="count">0</span>
 *       <button p-target="incBtn" p-trigger={{ click: 'INCREMENT' }}>+</button>
 *     </div>
 *   ),
 *   bProgram({ $ }) {
 *     const [countEl] = $('count');
 *     let count = 0;
 *
 *     return {
 *       INCREMENT() {
 *         count++;
 *         countEl.render(`${count}`);
 *       },
 *       DECREMENT() {
 *         count--;
 *         countEl.render(`${count}`);
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example
 * Worker Example
 * ```tsx
 * // worker.ts
 * import { defineWorker } from 'plaited'
 *
 * defineWorker<{
 *   processData: (args: { items: number[] }) => void
 * }>({
 *   publicEvents: ['processData'],
 *   bProgram({ send }) {
 *     return {
 *       processData({ items }) {
 *         const result = items.reduce((sum, item) => sum + item, 0);
 *         send({
 *           type: 'RESULT',
 *           detail: { sum: result }
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * // component.ts
 * import { defineElement, useWorker } from 'plaited'
 *
 * const DataProcessor = defineElement({
 *   tag: 'data-processor',
 *   shadowDom: <div p-target="result">Ready</div>,
 *   bProgram({ $, trigger }) {
 *     const [result] = $('result');
 *     const sendToWorker = useWorker(trigger, './worker.js');
 *
 *     return {
 *       PROCESS_CLICK() {
 *         sendToWorker({
 *           type: 'processData',
 *           detail: { items: [1, 2, 3, 4, 5] }
 *         });
 *       },
 *       RESULT({ sum }) {
 *         result.render(`Sum: ${sum}`);
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @remarks
 * Plaited is organized into several core areas:
 *
 * 1. **Component System**: Define custom elements with encapsulated behavior
 * 2. **Behavioral Programming**: Event-driven state management
 * 3. **Worker Integration**: Type-safe web worker communication
 * 4. **Styling System**: CSS-in-JS with proper encapsulation
 * 5. **JSX Support**: Declarative template creation
 *
 * Key features include:
 * - Shadow DOM encapsulation
 * - Behavioral thread synchronization
 * - Event delegation with p-trigger
 * - Element targeting with p-target
 * - Form association support
 * - Type-safe worker communication
 */

/**
 * Core Component Definition and DOM Utilities
 *
 * These exports provide the foundation for creating and working with custom elements,
 * managing their lifecycle, and interacting with the DOM in a type-safe manner.
 */
//MAIN
export type * from './main/plaited.types.js'
export * from './main/plaited.guards.js'
export * from './main/define-element.js'
export * from './main/define-worker.js'
export * from './main/use-attributes-observer.js'
export * from './main/use-template.js'
export * from './main/use-dispatch.js'
export * from './main/use-signal.js'
export * from './main/use-worker.js'

/**
 * Styling System
 *
 * Provides a type-safe CSS-in-JS solution with automatic style encapsulation
 * and injection into Shadow DOM. Supports responsive design, media queries,
 * and themed styling.
 */
//STYLE
export type * from './styling/css.types.js'
export * from './styling/css.js'

/**
 * JSX Runtime and Templating
 *
 * Enables declarative UI description using JSX syntax, with comprehensive
 * type checking and security features. Includes server-side rendering capabilities
 * and template composition utilities.
 */
//JSX
export type * from './jsx/jsx.types.js'
export * from './jsx/ssr.js'
export * from './jsx/create-template.js'
