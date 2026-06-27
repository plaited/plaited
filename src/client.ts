/**
 * UI entry point for the Plaited framework.
 * Exports primitives for server-rendered UI, controller islands, and CSS generation.
 *
 * @remarks
 * This module provides access to:
 * - **Controller runtime**: {@link Controller} serves the browser controller bootstrap.
 * - **Wire contracts**: controller schemas validate server commands and browser-to-server messages.
 * - **Projection journal**: UI projection events materialize topic-scoped reconnect state.
 * - **Rendering**: {@link createSSR} serializes templates with per-connection style deduplication.
 * - **Styling**: style, token, keyframe, host style, root style, and join helpers.
 *
 * @public
 */

export * from './client/controller.ts'
export type * from './client/controller.types.ts'
export type * from './client/css.types.ts'
export * from './client/host-styles.ts'
export * from './client/join-styles.ts'
export * from './client/keyframes.ts'
export * from './client/root-styles.ts'
export * from './client/ssr.ts'
export * from './client/styles.ts'
export * from './client/template.constants.ts'
export * from './client/template.ts'
export type * from './client/template.types.ts'
export * from './client/tokens.ts'
