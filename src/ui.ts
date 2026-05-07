/**
 * UI entry point for the Plaited framework.
 * Exports primitives for server-rendered UI, controller islands, and CSS generation.
 *
 * @remarks
 * This module provides access to:
 * - **Controller runtime**: {@link Controller} serves the browser controller bootstrap.
 * - **Wire contracts**: controller schemas validate server commands and browser-to-server messages.
 * - **Rendering**: {@link createSSR} serializes templates with per-connection style deduplication.
 * - **Styling**: style, token, keyframe, host style, root style, and join helpers.
 * - **Declarative Shadow DOM**: {@link decorateElements} prepares rendered custom elements.
 *
 * @public
 */

export * from './controller/controller.schemas.ts'
export * from './controller/controller.ts'
export * from './controller/controller.types.ts'
export type * from './css/css.types.ts'
export * from './css/host-styles.ts'
export * from './css/join-styles.ts'
export * from './css/keyframes.ts'
export * from './css/root-styles.ts'
export * from './css/styles.ts'
export * from './css/tokens.ts'
export * from './render/decorate-elements.ts'
export * from './render/ssr.ts'
export type * from './render/template.types.ts'
