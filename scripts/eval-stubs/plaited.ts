/**
 * Eval stub for the `plaited` package import.
 *
 * @remarks
 * Generated modules import `{ h, Fragment, createSSR }` from 'plaited'.
 * This stub re-exports them from the correct source files for Layer 2
 * tsc validation in the dev autoresearch harness.
 *
 * h and Fragment live in the JSX runtime; createSSR lives in ui/render/ssr.
 * This stub is NOT a replacement for the real plaited package — it exists
 * solely so tsc can resolve imports in eval workspaces.
 */

export { createTemplate as h, Fragment } from '../../src/ui/render/template.ts'
export { createSSR } from '../../src/ui/render/ssr.ts'
