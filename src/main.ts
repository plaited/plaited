/**
 * Main entry point for the Plaited framework.
 * Exports the complete public API for building reactive custom elements using behavioral programming.
 *
 * @remarks
 * This module provides access to:
 * - **BehavioralElement**: {@link bElement}, {@link bWorker} - Custom element creation with behavioral programming integration
 * - **Behavioral Programming**: {@link behavioral}, {@link bThread}, {@link bSync}, {@link useBehavioral} - Event coordination and synchronization
 * - **State Management**: {@link useSignal}, {@link useComputed} - Reactive state containers
 * - **Styling**: {@link createStyles}, {@link createHostStyles}, {@link createKeyframes}, {@link createTokens}, {@link joinStyles} - CSS-in-JS utilities
 * - **Templates**: {@link ssr}, {@link useTemplate} - Server-side rendering and template utilities
 * - **Utilities**: {@link useDispatch}, {@link useAttributesObserver}, {@link useWorker} - Framework utilities
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './main/b-element.guards.ts'
export * from './main/b-element.ts'
export type * from './main/b-element.types.ts'
export * from './main/b-worker.ts'
//Behavioral
export * from './main/behavioral.ts'
export type * from './main/behavioral.types.ts'
export * from './main/behavioral.utils.ts'
export * from './main/create-host-styles.ts'
export * from './main/create-keyframes.ts'
export * from './main/create-styles.ts'
export type * from './main/create-template.types.ts'
export * from './main/create-tokens.ts'
export type * from './main/css.types.ts'
export * from './main/join-styles.ts'
export * from './main/ssr.ts'
export * from './main/use-attributes-observer.ts'
export * from './main/use-behavioral.ts'
export * from './main/use-signal.ts'
export * from './main/use-template.ts'
export * from './main/use-worker.ts'
