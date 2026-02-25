import type { AgentToolCall } from '../../agent/agent.schemas.ts'
import type { GateCheck } from '../../agent/agent.types.ts'
import type { RulesFunction } from '../../behavioral/behavioral.types.ts'

/** A constitution rule that can block tool calls. test returns true = BLOCKED. */
export type ConstitutionRule = {
  name: string
  description?: string
  test: (toolCall: AgentToolCall) => boolean
}

/** Config-driven rule definition (JSON-serializable, converted to ConstitutionRule via constitutionRule()) */
export type ConstitutionRuleConfig = {
  name: string
  description?: string
  blockedTools?: string[]
  pathPattern?: string
  argPattern?: { key: string; pattern: string }
}

/** Return type of createConstitution() — threads for bThreads.set(), gateCheck for proposed_action */
export type Constitution = {
  threads: Record<string, RulesFunction>
  gateCheck: GateCheck
}
