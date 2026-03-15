import { RISK_TAG } from './agent.constants.ts'
import type { AgentToolCall } from './agent.schemas.ts'

// ============================================================================
// Gate Check Types
// ============================================================================

/**
 * Routing decision from the gate check.
 *
 * @public
 */
export type GateRoute = 'execute' | 'simulate' | 'rejected'

/**
 * Result of a gate check evaluation.
 *
 * @public
 */
export type GateCheckResult = {
  route: GateRoute
  reason?: string
}

/**
 * A named predicate for constitution-level tool call validation.
 *
 * @remarks
 * Used by {@link composedGateCheck} for early rejection before events reach BP.
 * Each predicate mirrors a constitution bThread's block logic, providing
 * user-facing rejection reasons at the gate level.
 *
 * @public
 */
export type ConstitutionPredicate = {
  name: string
  check: (toolCall: AgentToolCall) => boolean
}

// ============================================================================
// composedGateCheck — pure routing function
// ============================================================================

/**
 * Determines routing for a tool call based on risk tags and constitution predicates.
 *
 * @remarks
 * Routing logic (evaluated in order):
 * 1. If any constitution predicate matches → `'rejected'` with reason
 * 2. If tags are non-empty and all `workspace` → `'execute'` (skip simulation)
 * 3. Otherwise (empty, unknown, or mixed tags) → `'simulate'` (full pipeline)
 *
 * This is a pure function with no side effects or BP interaction.
 * The agent loop wires it into the `gate_approved`/`gate_rejected` event flow.
 *
 * @param args - Tool call and its risk tags
 * @param args.toolCall - The tool call to evaluate
 * @param args.tags - Composable risk tags from the tool definition
 * @param constitutionPredicates - Optional constitution-level checks
 * @returns Gate routing decision
 *
 * @public
 */
export const composedGateCheck = (
  { toolCall, tags }: { toolCall: AgentToolCall; tags: Set<string> },
  constitutionPredicates: ConstitutionPredicate[] = [],
): GateCheckResult => {
  // 1. Constitution predicates — hard rejections
  for (const predicate of constitutionPredicates) {
    if (predicate.check(toolCall)) {
      return { route: 'rejected', reason: `Blocked by ${predicate.name}` }
    }
  }

  // 2. Workspace-only tags → execute directly (skip simulation)
  if (tags.size > 0 && [...tags].every((tag) => tag === RISK_TAG.workspace)) {
    return { route: 'execute' }
  }

  // 3. Default: simulate (empty, unknown, or mixed tags)
  return { route: 'simulate' }
}
