/**
 * Plaited Behavioral Programming System
 *
 * A comprehensive implementation of the Behavioral Programming paradigm for JavaScript/TypeScript,
 * enabling the development of reactive systems through coordinated behavioral threads.
 *
 * Core Concepts:
 * - B-threads: Independent threads of behavior that can request, wait for, and block events
 * - Events: Messages that coordinate thread behavior and carry data
 * - Synchronization Points: Where threads align to make decisions about next events
 *
 * @example
 * Basic Setup
 * ```ts
 * import { bProgram, bThread, bSync } from 'plaited/behavioral'
 *
 * const { bThreads, trigger, useFeedback } = bProgram()
 *
 * // Define threads
 * bThreads.set({
 *   hotWater: bThread([
 *     bSync({ request: { type: 'HOT' } })
 *   ]),
 *   coldWater: bThread([
 *     bSync({ request: { type: 'COLD' } })
 *   ])
 * })
 *
 * // Handle events
 * useFeedback({
 *   HOT: () => console.log('Hot water added'),
 *   COLD: () => console.log('Cold water added')
 * })
 *
 * // Start the program
 * trigger({ type: 'START' })
 * ```
 *
 * @example
 * Component Integration
 * ```ts
 * import { defineBProgram } from 'plaited/behavioral'
 *
 * const waterSystem = defineBProgram({
 *   publicEvents: ['ADD_HOT', 'ADD_COLD'],
 *   bProgram: ({ bThreads, bSync, bThread }) => {
 *     bThreads.set({
 *       temperature: bThread([
 *         bSync({ waitFor: 'ADD_HOT', block: 'ADD_COLD' }),
 *         bSync({ waitFor: 'ADD_COLD', block: 'ADD_HOT' })
 *       ], true)
 *     })
 *     return {
 *       ADD_HOT: () => updateTemperature('hot'),
 *       ADD_COLD: () => updateTemperature('cold')
 *     }
 *   }
 * })
 * ```
 *
 * @packageDocumentation
 *
 * @remarks
 * Key Features:
 * - Type-safe event handling and thread coordination
 * - Component framework integration support
 * - Built-in debugging and state observation
 * - Priority-based event selection
 * - Automatic dependency cleanup
 *
 * Core Exports:
 * - {@link bProgram} - Creates behavioral program instances
 * - {@link bThread} - Defines behavioral threads
 * - {@link bSync} - Creates synchronization points
 * - {@link defineBProgram} - Higher-order program factory
 * - {@link BPEvent} - Event type definitions
 * - {@link Handlers} - Event handler type definitions
 *
 * Utilities:
 * - randomEvent - Random event selection strategy
 * - shuffleSyncs - Random synchronization order
 * - getPublicTrigger - Event visibility control
 * - getPlaitedTrigger - Enhanced trigger with cleanup
 */

//BEHAVIORAL
export * from './behavioral/b-program.js'
export * from './behavioral/b-thread.js'
export * from './behavioral/random-event.js'
export * from './behavioral/shuffle-syncs.js'
export * from './behavioral/get-public-trigger.js'
export * from './behavioral/get-plaited-trigger.js'
export * from './behavioral/define-b-program.js'
