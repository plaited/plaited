import { RISK_CLASS } from './agent.constants.ts'
import type { AgentToolCall, GateDecision } from './agent.schemas.ts'
import type { GateCheck } from './agent.types.ts'

// ============================================================================
// Risk Classification
// ============================================================================

/** Read-only tool names that have no side effects */
const READ_ONLY_TOOLS = new Set(['read_file', 'list_files', 'save_plan'])

/** Tools that modify state but within controlled boundaries */
const SIDE_EFFECT_TOOLS = new Set(['write_file'])

/** Tools that require the highest scrutiny */
const HIGH_AMBIGUITY_TOOLS = new Set(['bash'])

/**
 * Classifies the risk level of a tool call.
 *
 * @remarks
 * Pure routing function — determines which path the tool call takes
 * through the agent loop:
 * - `read_only` — skip simulation, execute directly
 * - `side_effects` — route through Dreamer simulation
 * - `high_ambiguity` — route through Dreamer + neural scorer
 *
 * Containment (filesystem, network, process isolation) is handled
 * by the deployment sandbox, not the framework.
 *
 * @param toolCall - The tool call to classify
 * @returns A `RISK_CLASS` value
 *
 * @public
 */
export const classifyRisk = (toolCall: AgentToolCall) => {
  if (READ_ONLY_TOOLS.has(toolCall.name)) return RISK_CLASS.read_only
  if (SIDE_EFFECT_TOOLS.has(toolCall.name)) return RISK_CLASS.side_effects
  if (HIGH_AMBIGUITY_TOOLS.has(toolCall.name)) return RISK_CLASS.high_ambiguity
  // Unknown tools get conservative classification
  return RISK_CLASS.high_ambiguity
}

// ============================================================================
// Gate Check Factory
// ============================================================================

/**
 * Creates a `GateCheck` function that evaluates proposed tool calls.
 *
 * @remarks
 * The gate classifies risk and runs custom checks (short-circuit on rejection).
 * Custom checks are the extension point for domain-specific semantic rules
 * (e.g., "require approval for database migrations", "block production config deletes").
 *
 * Filesystem/network/process containment is delegated to the deployment sandbox
 * (srt, Landlock, Modal gVisor) — not enforced here.
 *
 * @param options.customChecks - Optional checks run before returning approval
 * @returns A `GateCheck` function
 *
 * @public
 */
export const createGateCheck = ({
  customChecks,
}: {
  customChecks?: Array<(toolCall: AgentToolCall) => { safe: boolean; reason?: string }>
} = {}): GateCheck => {
  return (toolCall: AgentToolCall): GateDecision => {
    const riskClass = classifyRisk(toolCall)

    // Run custom checks (short-circuit on rejection)
    if (customChecks) {
      for (const check of customChecks) {
        const result = check(toolCall)
        if (!result.safe) {
          return { approved: false, riskClass, reason: result.reason }
        }
      }
    }

    return { approved: true, riskClass }
  }
}
