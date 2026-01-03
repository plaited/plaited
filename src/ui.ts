/**
 * UI entry point for the Plaited framework.
 * Exports the UI-specific APIs for building reactive custom elements with Shadow DOM.
 *
 * @remarks
 * This module provides access to:
 * - **BehavioralElement**: {@link bElement} - Custom element creation with behavioral programming integration
 * - **Styling**: {@link createStyles}, {@link createHostStyles}, {@link createKeyframes}, {@link createTokens}, {@link joinStyles} - CSS-in-JS utilities
 * - **Templates**: {@link ssr}, {@link useTemplate} - Server-side rendering and template utilities
 * - **Utilities**: {@link useAttributesObserver} - Attribute observation
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './ui/b-element.guards.ts'
export * from './ui/b-element.ts'
export type * from './ui/b-element.types.ts'
export * from './ui/create-host-styles.ts'
export * from './ui/create-keyframes.ts'
export * from './ui/create-styles.ts'
export type * from './ui/create-template.types.ts'
export * from './ui/create-tokens.ts'
export type * from './ui/css.types.ts'
export * from './ui/join-styles.ts'
export * from './ui/ssr.ts'
export * from './ui/use-attributes-observer.ts'
export * from './ui/use-template.ts'
