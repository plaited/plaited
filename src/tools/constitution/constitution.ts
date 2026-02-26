import { z } from 'zod'
import { AGENT_EVENTS, RISK_CLASS } from '../../agent/agent.constants.ts'
import type { AgentToolCall, GateDecision } from '../../agent/agent.schemas.ts'
import type { GateCheck } from '../../agent/agent.types.ts'
import { bSync, bThread } from '../../behavioral/behavioral.utils.ts'
import { ClassifyRiskConfigSchema } from './constitution.schemas.ts'
import type { Constitution, ConstitutionRule, ConstitutionRuleConfig } from './constitution.types.ts'

// ============================================================================
// Risk Classification
// ============================================================================

/** Read-only tool names that have no side effects */
const READ_ONLY_TOOLS = new Set(['read_file', 'list_files', 'save_plan', 'search'])

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

// ============================================================================
// Constitution Factory — dual-layer safety (bThreads + imperative gateCheck)
// ============================================================================

/**
 * Creates a constitution from an array of rules — dual-layer safety:
 *
 * @remarks
 * **Layer 1 — bThreads (defense-in-depth):** Each rule becomes a
 * `constitution_{name}` bThread with `repeat: true` that blocks
 * `execute` events matching its predicate. Consistent with the
 * existing `symbolicSafetyNet` pattern.
 *
 * **Layer 2 — imperative gateCheck (feedback):** Returns a `GateCheck`
 * function that runs the same rules. Called in the `context_ready`
 * handler, routes violations to `gate_rejected` which provides
 * feedback to the model (pushes rejection reason to history).
 *
 * @param rules - Array of constitution rules (test returns true = BLOCKED)
 * @returns `{ threads, gateCheck }` — threads for `bThreads.set()`, gateCheck for `context_ready`
 *
 * @public
 */
export const createConstitution = (rules: ConstitutionRule[]): Constitution => {
  // Layer 1: bThreads — block execute as safety net
  const threads: Constitution['threads'] = {}
  for (const rule of rules) {
    threads[`constitution_${rule.name}`] = bThread(
      [
        bSync({
          block: (event) => {
            if (event.type !== AGENT_EVENTS.execute) return false
            return rule.test(event.detail?.toolCall)
          },
        }),
      ],
      true,
    )
  }

  // Layer 2: imperative gateCheck — for feedback via gate_rejected
  const gateCheck: GateCheck = (toolCall) => {
    const riskClass = classifyRisk(toolCall)
    for (const rule of rules) {
      if (rule.test(toolCall)) {
        return { approved: false, riskClass, reason: rule.description ?? `Blocked by rule: ${rule.name}` }
      }
    }
    return { approved: true, riskClass }
  }

  return { threads, gateCheck }
}

// ============================================================================
// Config-Driven Rule Utility
// ============================================================================

/**
 * Converts a JSON-serializable config into a `ConstitutionRule`.
 *
 * @remarks
 * Supports three config fields, combined with OR logic:
 * - `blockedTools` — exact tool name match
 * - `pathPattern` — regex against `arguments.path`
 * - `argPattern` — regex against `arguments[key]`
 *
 * @param config - JSON-serializable rule definition
 * @returns A `ConstitutionRule` with a compiled test predicate
 *
 * @public
 */
export const constitutionRule = (config: ConstitutionRuleConfig): ConstitutionRule => {
  const checks: Array<(tc: AgentToolCall) => boolean> = []

  if (config.blockedTools?.length) {
    const tools = new Set(config.blockedTools)
    checks.push((tc) => tools.has(tc.name))
  }
  if (config.pathPattern) {
    const re = new RegExp(config.pathPattern)
    checks.push((tc) => re.test(String(tc.arguments.path ?? '')))
  }
  if (config.argPattern) {
    const re = new RegExp(config.argPattern.pattern)
    const key = config.argPattern.key
    checks.push((tc) => re.test(String(tc.arguments[key] ?? '')))
  }

  return {
    name: config.name,
    description: config.description,
    test: (tc) => checks.some((check) => check(tc)),
  }
}

// ============================================================================
// CLI Handler
// ============================================================================

export const classifyRiskCli = async (args: string[]): Promise<void> => {
  if (args.includes('--schema')) {
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify(z.toJSONSchema(ClassifyRiskConfigSchema), null, 2))
    return
  }
  const jsonIdx = args.indexOf('--json')
  if (jsonIdx === -1 || !args[jsonIdx + 1]) {
    console.error("Usage: plaited classify-risk --json '{...}' | --schema")
    process.exit(1)
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by process.exit above
  const parsed = ClassifyRiskConfigSchema.safeParse(JSON.parse(args[jsonIdx + 1]!))
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }
  const { toolName, args: toolArgs } = parsed.data
  const risk = classifyRisk({ id: 'cli', name: toolName, arguments: toolArgs })
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify({ toolName, riskClass: risk }))
}
