/**
 * Main entry point for the Plaited framework.
 * Exports the behavioral programming APIs for event coordination and state management.
 *
 * @remarks
 * This module provides access to:
 * - **Behavioral Programming**: {@link behavioral}, {@link bThread}, {@link bSync}, {@link useBehavioral} - Event coordination and synchronization
 * - **Workers**: {@link bWorker}, {@link useWorker} - Web Worker integration with BP
 *
 * For UI-specific APIs (styling, templates, rendering), import from 'plaited/ui'.
 *
 * @public
 */

export * from './main/b-worker.ts'
export * from './main/behavioral.ts'
export type * from './main/behavioral.types.ts'
export * from './main/behavioral.utils.ts'
export * from './main/use-behavioral.ts'
export * from './main/use-worker.ts'
