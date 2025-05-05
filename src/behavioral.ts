/**
 * Plaited Behavioral Programming Module
 *
 * This module provides tools and utilities for implementing application logic
 * using the Be havioral Programming paradigm. It allows developers to define
 * independent behavioral threads (b-threads) that coordinate through events.
 *
 * Key exports include:
 * - `bProgram`: Factory function to create a behavioral program instance.
 * - `bThread`: Factory function to define a behavioral thread from synchronization rules.
 * - `bSync`: Factory function to create a single synchronization point (idiom).
 * - `defineBProgram`: A higher-order function for structuring and initializing b-programs,
 *   often used within component frameworks.
 * - Utilities like `randomEvent`, `shuffleSyncs`, `getPublicTrigger`, `getPlaitedTrigger`.
 * - Associated types like `BPEvent`, `Handlers`, `SnapshotMessage`, `Trigger`, `Disconnect`, etc.
 *
 * @module behavioral
 */
//BEHAVIORAL
export * from './behavioral/b-program.js'
export * from './behavioral/b-thread.js'
export * from './behavioral/random-event.js'
export * from './behavioral/shuffle-syncs.js'
export * from './behavioral/get-public-trigger.js'
export * from './behavioral/get-plaited-trigger.js'
export * from './behavioral/define-b-program.js'
