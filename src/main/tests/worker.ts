/**
 * Example of creating a Web Worker using Plaited's worker system.
 * Demonstrates how to create type-safe, event-driven background processing.
 *
 * Features:
 * - Type-safe message passing
 * - Event-based communication
 * - Automatic cleanup
 * - Error handling
 *
 * @example
 * ```tsx
 * // In worker.ts
 * defineWorker<{
 *   processData: (args: { data: number[] }) => void
 * }>({
 *   publicEvents: ['processData'],
 *   bProgram({ send }) {
 *     return {
 *       processData({ data }) {
 *         const result = data.reduce((a, b) => a + b, 0);
 *         send({
 *           type: 'result',
 *           detail: { sum: result }
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * // In component
 * const Component = defineElement({
 *   tag: 'data-processor',
 *   bProgram({ trigger }) {
 *     const worker = useWorker(trigger, './worker.ts');
 *     return {
 *       process() {
 *         worker({
 *           type: 'processData',
 *           detail: { data: [1, 2, 3, 4, 5] }
 *         });
 *       }
 *     };
 *   }
 * });
 * ```
 */

import { defineWorker } from 'plaited'

const calculator = {
  add(a: number, b: number) {
    return a + b
  },
  subtract(a: number, b: number) {
    return a - b
  },
  multiply(a: number, b: number) {
    return a * b
  },
  divide(a: number, b: number) {
    return a / b
  },
}

defineWorker<{
  calculate: (args: { a: number; b: number; operation: 'add' | 'subtract' | 'multiply' | 'divide' }) => void
}>({
  publicEvents: ['calculate'],
  bProgram({ send }) {
    return {
      calculate({ a, b, operation }) {
        send({
          type: 'update',
          detail: calculator[operation](a, b),
        })
      },
    }
  },
})
