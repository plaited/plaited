/**
 * Plaited Behavioral Programming System
 *
 * A comprehensive implementation of the Behavioral Programming (BP) paradigm for JavaScript/TypeScript,
 * enabling the development of reactive, event-driven systems through coordinated behavioral threads.
 *
 * ## Core Concepts
 *
 * - **B-threads**: Independent threads of behavior that encapsulate specific system aspects. Each
 *   b-thread can request events, wait for events from other threads, or block events from occurring.
 *   B-threads execute independently but synchronize at specific points to coordinate decisions.
 *
 * - **Events**: Typed messages with optional payloads that coordinate thread behavior and carry data
 *   between threads. Events are the primary communication mechanism in the BP model and can be
 *   requested, waited for, blocked, or used to interrupt other threads.
 *
 * - **Synchronization Points**: Strategic locations in b-thread execution where all threads align
 *   to make collective decisions about which event to select next. At these points, threads declare
 *   their behavioral intentions (request, waitFor, block, interrupt) using the `bSync` function.
 *
 * - **Behavioral Idioms**: At each synchronization point, threads express their intentions through four key idioms:
 *   - `request`: Propose an event for selection (not guaranteed to be selected)
 *   - `waitFor`: Pause execution until a matching event is selected
 *   - `block`: Prevent specific events from being selected while at this sync point
 *   - `interrupt`: Specify events that, if selected, will terminate this thread's execution flow
 *
 * - **Event Selection Mechanism**: The BP system employs a priority-based selection process to choose
 *   the next event at each synchronization point. It considers all requested events, filters out
 *   blocked ones, and selects the highest priority remaining candidate event.
 *
 * ## Execution Model
 *
 * BP programs follow a "super-step" execution model:
 *
 * 1. B-threads run until they reach synchronization points (yield)
 * 2. All synchronization declarations (request, waitFor, block, interrupt) are collected
 * 3. The system selects the highest priority non-blocked event
 * 4. B-threads waiting for the selected event are resumed
 * 5. B-threads that would be interrupted by the selected event are terminated
 * 6. External handlers registered through `useFeedback` are notified
 * 7. The cycle repeats until no further events can be selected
 *
 * @example
 * Basic Setup
 * ```ts
 * import { bProgram, bThread, bSync } from 'plaited/behavioral'
 *
 * // Create a behavioral program instance
 * const { bThreads, trigger, useFeedback } = bProgram()
 *
 * // Define threads
 * bThreads.set({
 *   hotWater: bThread([
 *     bSync({ request: { type: 'HOT' } })
 *   ]),
 *   coldWater: bThread([
 *     bSync({ request: { type: 'COLD' } })
 *   ]),
 *   // Thread that enforces alternating hot/cold pattern
 *   alternating: bThread([
 *     bSync({ waitFor: 'HOT', block: 'COLD' }),
 *     bSync({ waitFor: 'COLD', block: 'HOT' })
 *   ], true), // true makes the thread repeat indefinitely
 *   // Thread that will be interrupted by STOP event
 *   temperatureMonitor: bThread([
 *     bSync({
 *       waitFor: 'START_MONITORING',
 *       interrupt: 'STOP' // This thread will terminate if STOP occurs
 *     }),
 *     bSync({ request: { type: 'CHECK_TEMPERATURE' } }),
 *     bSync({
 *       waitFor: 'TEMPERATURE_OK',
 *       interrupt: 'STOP' // Can be interrupted at any sync point
 *     })
 *   ], true)
 * })
 *
 * // Handle selected events with external actions
 * useFeedback({
 *   HOT: () => console.log('Hot water added'),
 *   COLD: () => console.log('Cold water added'),
 *   CHECK_TEMPERATURE: () => console.log('Temperature checked'),
 *   STOP: () => console.log('Monitoring interrupted')
 * })
 *
 * // Start the program
 * trigger({ type: 'START' })
 *
 * // Later, interrupt the monitoring thread
 * trigger({ type: 'STOP' })
 * ```
 *
 * @example
 * Component Integration
 * ```ts
 * import { defineBProgram } from 'plaited/behavioral'
 *
 * // Create a reusable behavioral program with a defined public API
 * const waterSystem = defineBProgram({
 *   // Only these events can be triggered from outside
 *   publicEvents: ['ADD_HOT', 'ADD_COLD'],
 *
 *   // Define the behavioral program's internal logic
 *   bProgram: ({ bThreads, bSync, bThread, trigger }) => {
 *     // Set up internal b-threads
 *     bThreads.set({
 *       temperature: bThread([
 *         bSync({ waitFor: 'ADD_HOT', block: 'ADD_COLD' }),
 *         bSync({ waitFor: 'ADD_COLD', block: 'ADD_HOT' })
 *       ], true),
 *
 *       // Thread to detect extreme temperatures
 *       monitor: bThread([
 *         bSync({
 *           waitFor: ['TEMP_TOO_HIGH', 'TEMP_TOO_LOW'],
 *           request: { type: 'ALARM' }
 *         })
 *       ], true)
 *     })
 *
 *     // Return event handlers for external feedback
 *     return {
 *       ADD_HOT: () => updateTemperature('hot'),
 *       ADD_COLD: () => updateTemperature('cold'),
 *       ALARM: (detail) => notifyUser(detail)
 *     }
 *   }
 * })
 *
 * // Initialize and get the public trigger for component use
 * const publicTrigger = waterSystem()
 * ```
 *
 * @packageDocumentation
 *
 * @remarks
 * ## Key Features
 *
 * - **Declarative Coordination**: Express complex system behaviors as simple, declarative threads
 * - **Type-safe Events**: Full TypeScript support for event types and payload structures
 * - **Component Integration**: Seamless integration with UI frameworks and component models
 * - **Debugging Support**: Built-in state observation and visualization through `useSnapshot`
 * - **Priority-based Selection**: Sophisticated event prioritization for conflict resolution
 * - **Dependency Management**: Automatic cleanup of resources and subscriptions
 * - **Incremental Development**: Add, modify, or replace behaviors without affecting others
 * - **Testability**: Isolated behaviors make testing and simulation straightforward
 *
 * ## Core Exports
 *
 * - {@link bProgram} - Creates independent behavioral program instances
 * - {@link bThread} - Defines behavioral threads from synchronization steps
 * - {@link bSync} - Creates individual synchronization points
 * - {@link defineBProgram} - Higher-order program factory for component integration
 * - {@link BPEvent} - Type definitions for events and their payloads
 * - {@link Handlers} - Type definitions for event feedback handlers
 * - {@link UseSnapshot} - Type for state observation callbacks
 * - {@link BThreads} - Interface for managing behavioral threads
 *
 * ## Utilities
 *
 * - **randomEvent** - Selects a random event from candidates for non-deterministic behavior
 * - **shuffleSyncs** - Randomizes the order of synchronization steps
 * - **getPublicTrigger** - Creates a restricted trigger for external API surface
 * - **getPlaitedTrigger** - Enhanced trigger with automatic resource cleanup
 */

//BEHAVIORAL
export * from './behavioral/b-program.js'
export * from './behavioral/b-thread.js'
export * from './behavioral/random-event.js'
export * from './behavioral/shuffle-syncs.js'
export * from './behavioral/get-public-trigger.js'
export * from './behavioral/get-plaited-trigger.js'
export * from './behavioral/define-b-program.js'
