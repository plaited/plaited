/**
 * Tools module for the Plaited framework.
 * Re-exports all tool implementations for programmatic use.
 *
 * @remarks
 * Each tool follows the tool genome pattern:
 * - `configSchema` — Zod schema (source of truth for --schema and --json validation)
 * - `run*()` — Programmatic runner (pure function, no CLI concerns)
 * - CLI handler — (args: string[]) => Promise<void>
 *
 * @public
 */

// CRUD tools
export { builtInToolSchemas, createToolExecutor } from './tools/crud/crud.ts'
