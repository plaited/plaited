/**
 * UI entry point for the Plaited framework.
 * Exports primitives for server-rendered UI, controller islands, and CSS generation.
 *
 * @remarks
 * This module provides access to:
 * - **Controller runtime**: {@link useController} serves the browser controller bootstrap.
 * - **Wire contracts**: controller schemas validate server commands and browser-to-server messages.
 * - **Rendering**: {@link createSSR} serializes templates with per-connection style deduplication.
 * - **Styling**: style, token, keyframe, host style, root style, and join helpers.
 * - **Declarative Shadow DOM**: {@link decorateElements} prepares rendered custom elements.
 *
 * @public
 */

export * from './ui/controller/controller.schemas.ts'
export * from './ui/controller/controller.types.ts'
export * from './ui/controller/use-mcp-sender.ts'
export type * from './ui/css/css.types.ts'
export * from './ui/css/host-styles.ts'
export * from './ui/css/join-styles.ts'
export * from './ui/css/keyframes.ts'
export * from './ui/css/root-styles.ts'
export * from './ui/css/styles.ts'
export * from './ui/css/tokens.ts'
export * from './ui/render/decorate-elements.ts'
export * from './ui/render/ssr.ts'
export type * from './ui/render/template.types.ts'
