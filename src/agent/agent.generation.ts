/**
 * Type definitions for the bThread generation flow.
 *
 * @remarks
 * The actual generation happens in the agent loop (model generates
 * TypeScript factories + companion tests). These types define the
 * request/result contract so other modules can reference them.
 *
 * Generation follows the test-first pattern from `CONSTITUTION.md`:
 * 1. Agent generates `.spec.ts` (test)
 * 2. Agent runs test → FAILS (no implementation)
 * 3. Agent generates `.ts` (implementation)
 * 4. Agent runs `tsc --noEmit` → passes
 * 5. Agent runs test → PASSES
 * 6. Thread loaded into BP engine
 *
 * @public
 */

import type { ThreadValidationResult } from '../tools/validate-thread.ts'

// ============================================================================
// Generation Request
// ============================================================================

/**
 * Request to generate a bThread factory.
 *
 * @remarks
 * Only `goal` and `workflow` kinds are generatable — constitution
 * factories are framework-provided and immutable.
 *
 * @public
 */
export type GenerationRequest = {
  /** Factory category to generate */
  kind: 'goal' | 'workflow'
  /** Natural language description of the desired behavior */
  description: string
  /** Additional constraints the generated factory must satisfy */
  constraints?: string[]
}

// ============================================================================
// Generation Result
// ============================================================================

/**
 * Result of generating a bThread factory.
 *
 * @remarks
 * Contains paths to both generated files (spec + implementation),
 * the validation result from the 7-check gate, and the factory brand.
 * A successful generation has `validation.valid === true`.
 *
 * @public
 */
export type GenerationResult = {
  /** Path to the generated companion test file */
  specPath: string
  /** Path to the generated factory implementation */
  implPath: string
  /** Validation result from `validateThreadFactory` */
  validation: ThreadValidationResult
  /** Factory brand — `🎯` for goals, `🔄` for workflows */
  brand: '🎯' | '🔄'
}
