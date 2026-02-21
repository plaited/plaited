/**
 * Main entry point for the Plaited framework.
 * Exports the behavioral programming APIs for event coordination and state management.
 *
 * @remarks
 * This module provides access to:
 * - **Behavioral Programming**: {@link behavioral}, {@link bThread}, {@link bSync}, {@link useBehavioral} - Event coordination and synchronization
 *
 * For UI-specific APIs (styling, templates, rendering), import from 'plaited/ui'.
 *
 * @public
 */

export * from './behavioral/behavioral.schemas.ts'
export * from './behavioral/behavioral.ts'
export type * from './behavioral/behavioral.types.ts'
export * from './behavioral/behavioral.utils.ts'
