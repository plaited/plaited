/**
 * Zod schemas for modnet module metadata.
 *
 * @remarks
 * MSS (Module Sharing Standard) bridge-code tags classify module content,
 * structure, and sharing boundaries. These live in the `"modnet"` field
 * of each module's `package.json`.
 *
 * @public
 */

import * as z from 'zod'

// ============================================================================
// MSS Boundary Values
// ============================================================================

/**
 * DAC boundary tag — controls cross-A2A sharing for a module's `data/` directory.
 *
 * - `all` — data freely available to authenticated peers
 * - `none` — data never crosses A2A boundary
 * - `ask` — ABAC evaluation per-request (BP predicates)
 * - `paid` — x402 payment gating
 */
export const BoundarySchema = z.enum(['all', 'none', 'ask', 'paid']).describe(
  'DAC boundary tag controlling cross-A2A data sharing',
)

// ============================================================================
// MSS Scale
// ============================================================================

/**
 * Module complexity scale (1–4).
 *
 * - S1: JSON data + template
 * - S2: Structured data + list rendering
 * - S3: Multiple files + behavioral code + streams
 * - S4+: Full package with workspace dependencies
 */
export const ScaleSchema = z.number().int().min(1).max(4).describe(
  'Module complexity scale (1=simple data, 4=full package with deps)',
)

// ============================================================================
// Modnet Field Schema
// ============================================================================

/**
 * The `"modnet"` field in a module's `package.json`.
 *
 * @example
 * ```json
 * {
 *   "modnet": {
 *     "contentType": "produce",
 *     "structure": "list",
 *     "mechanics": ["sort", "filter"],
 *     "boundary": "ask",
 *     "scale": 3
 *   }
 * }
 * ```
 */
export const ModnetFieldSchema = z.object({
  contentType: z.string().describe('MSS content classification (e.g., "produce", "code-review")'),
  structure: z.string().describe('Data structure pattern (e.g., "list", "tree", "graph")'),
  mechanics: z.array(z.string()).optional().describe('Interaction mechanics (e.g., ["sort", "filter"])'),
  boundary: BoundarySchema,
  scale: ScaleSchema,
})

export type ModnetField = z.infer<typeof ModnetFieldSchema>
