/**
 * UI entry point for the Plaited framework.
 * Exports primitives for server-rendered generative web UI.
 *
 * @remarks
 * This module provides access to:
 * - **Rendering**: {@link ssr}, {@link declarativeElement} - Server-side rendering and declarative Shadow DOM
 * - **Styling**: {@link createStyles}, {@link createHostStyles}, {@link createKeyframes}, {@link createTokens}, {@link joinStyles} - CSS-in-JS utilities
 * - **Protocol**: {@link ServerMessageSchema}, {@link ClientMessageSchema} - Server ↔ client message schemas
 * - **Event Delegation**: {@link DelegatedListener} - Delegated event handling for p-trigger
 * - **Style Tracking**: {@link createStyleTracker} - Per-connection style deduplication
 *
 * @public
 */

export * from './ui/control-elements.ts'
export * from './ui/create-host-styles.ts'
export * from './ui/create-keyframes.ts'
export * from './ui/create-root-styles.ts'
export * from './ui/create-style-tracker.ts'
export * from './ui/create-styles.ts'
export type * from './ui/create-template.types.ts'
export * from './ui/create-tokens.ts'
export type * from './ui/css.types.ts'
export * from './ui/decorate-elements.ts'
export * from './ui/join-styles.ts'
export * from './ui/ssr.ts'
export * from './ui/wire.ts'
