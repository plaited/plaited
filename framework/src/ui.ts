/**
 * UI entry point for the OnBraid framework.
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

export * from './ui/controller.ts'
export * from './ui/controller.types.ts'
export type * from './ui/css.types.ts'
export * from './ui/define-template.ts'
export * from './ui/host-styles.ts'
export * from './ui/join-styles.ts'
export * from './ui/keyframes.ts'
export * from './ui/root-styles.ts'
export * from './ui/ssr.ts'
export * from './ui/styles.ts'
export * from './ui/template.constants.ts'
export * from './ui/template.ts'
export type * from './ui/template.types.ts'
export * from './ui/tokens.ts'
