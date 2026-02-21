/**
 * UI entry point for the Plaited framework.
 * Exports primitives for server-rendered generative web UI.
 *
 * @remarks
 * This module provides access to:
 * - **Rendering**: {@link createSSR} - Server-side rendering with per-connection style deduplication
 * - **Styling**: {@link createStyles}, {@link createHostStyles}, {@link createKeyframes}, {@link createTokens}, {@link joinStyles} - CSS-in-JS utilities
 * - **Controller Protocol**: {@link controller} schemas, constants, and message types for server ↔ client communication
 * - **Custom Elements**: {@link controlIsland}, {@link decorateElements} - Custom element lifecycle coordination
 *
 * @public
 */

export * from './ui/control-document.ts'
export * from './ui/control-island.ts'
export * from './ui/controller.constants.ts'
export * from './ui/controller.schemas.ts'
export * from './ui/create-host-styles.ts'
export * from './ui/create-keyframes.ts'
export * from './ui/create-root-styles.ts'
export * from './ui/create-ssr.ts'
export * from './ui/create-styles.ts'
export type * from './ui/create-template.types.ts'
export * from './ui/create-tokens.ts'
export type * from './ui/css.types.ts'
export * from './ui/decorate-elements.ts'
export * from './ui/join-styles.ts'
