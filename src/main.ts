/**
 * Main entry point for the Plaited framework.
 * Exports the complete public API for building reactive web components using behavioral programming.
 *
 * @remarks
 * This module provides access to:
 * - **Web Components**: {@link bElement}, {@link bWorker} - Custom element creation with behavioral programming integration
 * - **Behavioral Programming**: {@link behavioral}, {@link bThread}, {@link bSync}, {@link useBehavioral} - Event coordination and synchronization
 * - **State Management**: {@link useSignal}, {@link useComputed} - Reactive state containers
 * - **Styling**: {@link createStyles}, {@link createHostStyles}, {@link createKeyframes}, {@link createTokens}, {@link joinStyles} - CSS-in-JS utilities
 * - **Templates**: {@link ssr}, {@link useTemplate} - Server-side rendering and template utilities
 * - **Utilities**: {@link useDispatch}, {@link useAttributesObserver}, {@link useWorker} - Framework utilities
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './main/b-element.js'
export type * from './main/b-element.types.js'
export * from './main/b-element.guards.js'
export * from './main/b-worker.js'
export * from './main/create-styles.js'
export * from './main/create-host-styles.js'
export * from './main/create-keyframes.js'
export * from './main/create-tokens.js'
export type * from './main/create-template.types.js'
export type * from './main/css.types.js'
export * from './main/ssr.js'
export * from './main/join-styles.js'
export * from './main/use-attributes-observer.js'
export * from './main/use-template.js'
export * from './main/use-dispatch.js'
export * from './main/use-worker.js'

//Behavioral
export * from './main/behavioral.js'
export type * from './main/behavioral.types.js'
export * from './main/behavioral.utils.js'
export * from './main/use-behavioral.js'
export * from './main/use-signal.js'
