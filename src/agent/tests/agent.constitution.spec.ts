import { describe, expect, test } from 'bun:test'
import { RISK_CLASS } from '../agent.constants.ts'
import { classifyRisk, createGateCheck } from '../agent.constitution.ts'
import type { AgentToolCall } from '../agent.schemas.ts'

// ============================================================================
// Helpers
// ============================================================================

const makeToolCall = (name: string, args: Record<string, unknown> = {}): AgentToolCall => ({
  id: `tc-${name}`,
  name,
  arguments: args,
})

// ============================================================================
// classifyRisk
// ============================================================================

describe('classifyRisk', () => {
  test('returns read_only for read_file', () => {
    expect(classifyRisk(makeToolCall('read_file'))).toBe(RISK_CLASS.read_only)
  })

  test('returns read_only for list_files', () => {
    expect(classifyRisk(makeToolCall('list_files'))).toBe(RISK_CLASS.read_only)
  })

  test('returns read_only for save_plan', () => {
    expect(classifyRisk(makeToolCall('save_plan'))).toBe(RISK_CLASS.read_only)
  })

  test('returns side_effects for write_file', () => {
    expect(classifyRisk(makeToolCall('write_file'))).toBe(RISK_CLASS.side_effects)
  })

  test('returns high_ambiguity for bash', () => {
    expect(classifyRisk(makeToolCall('bash'))).toBe(RISK_CLASS.high_ambiguity)
  })

  test('returns high_ambiguity for unknown tools', () => {
    expect(classifyRisk(makeToolCall('unknown_tool'))).toBe(RISK_CLASS.high_ambiguity)
    expect(classifyRisk(makeToolCall('execute_query'))).toBe(RISK_CLASS.high_ambiguity)
  })
})

// ============================================================================
// createGateCheck
// ============================================================================

describe('createGateCheck', () => {
  test('approves read_file with read_only risk', () => {
    const gate = createGateCheck()
    const decision = gate(makeToolCall('read_file', { path: 'src/file.ts' }))
    expect(decision.approved).toBe(true)
    expect(decision.riskClass).toBe(RISK_CLASS.read_only)
  })

  test('approves write_file with side_effects risk', () => {
    const gate = createGateCheck()
    const decision = gate(makeToolCall('write_file', { path: 'src/new.ts', content: 'content' }))
    expect(decision.approved).toBe(true)
    expect(decision.riskClass).toBe(RISK_CLASS.side_effects)
  })

  test('approves bash with high_ambiguity risk', () => {
    const gate = createGateCheck()
    const decision = gate(makeToolCall('bash', { command: 'echo hello' }))
    expect(decision.approved).toBe(true)
    expect(decision.riskClass).toBe(RISK_CLASS.high_ambiguity)
  })

  test('approves unknown tools with high_ambiguity risk', () => {
    const gate = createGateCheck()
    const decision = gate(makeToolCall('custom_tool', { foo: 'bar' }))
    expect(decision.approved).toBe(true)
    expect(decision.riskClass).toBe(RISK_CLASS.high_ambiguity)
  })

  test('runs custom checks before returning approval', () => {
    const customCheck = (tc: AgentToolCall) => {
      if (tc.name === 'write_file') return { safe: false, reason: 'Writes disabled by policy' }
      return { safe: true }
    }
    const gate = createGateCheck({ customChecks: [customCheck] })

    const decision = gate(makeToolCall('write_file', { path: 'src/safe.ts', content: '' }))
    expect(decision.approved).toBe(false)
    expect(decision.reason).toBe('Writes disabled by policy')
  })

  test('custom check short-circuits on first rejection', () => {
    let secondCheckCalled = false
    const checks = [
      () => ({ safe: false, reason: 'Blocked by first' }),
      () => {
        secondCheckCalled = true
        return { safe: true }
      },
    ]
    const gate = createGateCheck({ customChecks: checks })
    const decision = gate(makeToolCall('read_file', { path: 'src/file.ts' }))

    expect(decision.approved).toBe(false)
    expect(decision.reason).toBe('Blocked by first')
    expect(secondCheckCalled).toBe(false)
  })

  test('defaults to empty options when called with no arguments', () => {
    const gate = createGateCheck()
    const decision = gate(makeToolCall('bash', { command: 'rm -rf /' }))
    expect(decision.approved).toBe(true)
    expect(decision.riskClass).toBe(RISK_CLASS.high_ambiguity)
  })
})
