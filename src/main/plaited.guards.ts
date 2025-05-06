import type { Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import type { PlaitedMessage, PlaitedElement, PlaitedTemplate } from './plaited.types'
import { isTypeOf } from '../utils/is-type-of.js'
import type { FunctionTemplate } from '../jsx/jsx.types.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'

/**
 * Type guard to identify enhanced Plaited triggers with disconnect capability.
 * Used internally by the framework to ensure proper cleanup of component resources.
 *
 * @param trigger - The trigger function to check
 * @returns True if the trigger includes disconnect callback support
 *
 * @example Using in a custom effect implementation
 * ```tsx
 * const useCustomEffect = (trigger: Trigger | PlaitedTrigger, callback: () => () => void) => {
 *   if (isPlaitedTrigger(trigger)) {
 *     const cleanup = callback();
 *     // Register cleanup function to run on component disconnect
 *     trigger.addDisconnectCallback(cleanup);
 *   }
 * };
 *
 * // Usage in a component
 * const MyComponent = defineElement({
 *   tag: 'my-component',
 *   shadowDom: <div p-target="root" />,
 *   bProgram({ trigger }) {
 *     useCustomEffect(trigger, () => {
 *       const interval = setInterval(() => console.log('tick'), 1000);
 *       return () => clearInterval(interval);
 *     });
 *   }
 * });
 * ```
 */
export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger => 'addDisconnectCallback' in trigger

/**
 * Type guard to validate Plaited message structure.
 * Used for type-safe message handling in component communication.
 *
 * @param msg - Value to check as a potential Plaited message
 * @returns True if value matches required message structure
 *
 * @example Component communication with message validation
 * ```tsx
 * const MessageHandler = defineElement({
 *   tag: 'message-handler',
 *   shadowDom: (
 *     <div>
 *       <div p-target="status">Waiting for messages...</div>
 *       <slot p-target="content" />
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [status] = $('status');
 *
 *     // Set up message handling
 *     const handleMessage = (event: unknown) => {
 *       if (isPlaitedMessage(event)) {
 *         switch (event.type) {
 *           case 'UPDATE_STATUS':
 *             status.render(`Status: ${event.detail?.message || 'No message'}`);
 *             break;
 *           case 'RESET':
 *             status.render('Status reset');
 *             break;
 *         }
 *       }
 *     };
 *
 *     return {
 *       onConnected() {
 *         window.addEventListener('message', handleMessage);
 *       },
 *       onDisconnected() {
 *         window.removeEventListener('message', handleMessage);
 *       }
 *     };
 *   }
 * });
 *
 * // Sending messages
 * window.postMessage({
 *   address: 'message-handler',
 *   type: 'UPDATE_STATUS',
 *   detail: { message: 'Hello!' }
 * });
 * ```
 */
export const isPlaitedMessage = (msg: unknown): msg is PlaitedMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.type, 'string')
  )
}

/**
 * Type guard to identify Plaited custom elements.
 * Useful when working with DOM elements that might be Plaited components.
 *
 * @param el - Element to check
 * @returns True if element is a Plaited custom element
 *
 * @example Enhancing existing elements conditionally
 * ```tsx
 * const ComponentWrapper = defineElement({
 *   tag: 'component-wrapper',
 *   shadowDom: <slot p-target="content"  p-trigger={{slotchange: 'enhanceChildren'}}/>,
 *   bProgram({ $, trigger }) {
 *     const [content] = $('content');
 *
 *     const ;
 *
 *     return {
 *       enhanceChildren = () => {
 *       const children = content.assignedElements();
 *       children.forEach(child => {
 *         if (isPlaitedElement(child)) {
 *           // Can safely use Plaited features
 *           child.trigger({
 *             type: 'PARENT_CONNECTED',
 *             detail: { parentId: 'wrapper' }
 *           });
 *         } else {
 *           console.log('Regular element:', child.tagName);
 *         }
 *       });
 *     }
 *   }
 * });
 *
 * // Usage
 * <ComponentWrapper>
 *   <my-plaited-element />
 *   <div>Regular element</div>
 * </ComponentWrapper>
 * ```
 *
 * @remarks
 * - Returns true only for elements that inherit from HTMLElement and implement the Plaited interface
 * - Type guard ensures TypeScript correctly narrows the type for trigger and other Plaited features
 * - Useful in mixed DOM environments where both Plaited and regular elements exist
 */
export const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el

/**
 * Type guard to identify Plaited template functions.
 * Used to verify that a function template was created by the Plaited framework.
 *
 * @param template - The function template to check
 * @returns True if the template is a valid Plaited template function
 *
 * @remarks
 * - Checks both type structure and the presence of Plaited's unique identifier
 * - Used internally by the framework to ensure template safety
 * - Helps prevent injection of invalid or malicious templates
 * - Type guard provides TypeScript type narrowing
 */
export const isPlaitedTemplateFunction = (template: FunctionTemplate): template is PlaitedTemplate =>
  isTypeOf<PlaitedTemplate>(template, 'object') && template.$ === PLAITED_TEMPLATE_IDENTIFIER
