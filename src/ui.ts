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

export type * from './ui/css/css.types.ts'
export * from './ui/css/host-styles.ts'
export * from './ui/css/join-styles.ts'
export * from './ui/css/keyframes.ts'
export * from './ui/css/root-styles.ts'
export * from './ui/css/styles.ts'
export * from './ui/css/tokens.ts'
export * from './ui/dom/control-document.ts'
export * from './ui/dom/control-island.ts'
export * from './ui/dom/decorate-elements.ts'
export * from './ui/protocol/controller.constants.ts'
export * from './ui/protocol/controller.schemas.ts'
export * from './ui/protocol/use-ui-module.ts'
export * from './ui/render/ssr.ts'
export type * from './ui/render/template.types.ts'
