/**
 * Main entry point for the Plaited framework.
 * Exports the behavioral programming APIs for event coordination and state management.
 *
 * @remarks
 * This module provides access to:
 * - **Behavioral Programming**: {@link behavioral}, {@link bThread}, {@link bSync}, {@link useBehavioral} - Event coordination and synchronization
 * - **State Management**: {@link useSignal}, {@link useComputed} - Reactive state containers
 * - **Workers**: {@link bWorker}, {@link useWorker} - Web Worker integration with BP
 * - **Debugging**: {@link inspector} - Behavioral program inspection
 *
 * For UI-specific APIs (bElement, styling, templates), import from 'plaited/ui'.
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './main/b-worker.ts'
export * from './main/behavioral.ts'
export type * from './main/behavioral.types.ts'
export * from './main/behavioral.utils.ts'
export * from './main/use-behavioral.ts'
export * from './main/use-signal.ts'
export * from './main/use-worker.ts'
