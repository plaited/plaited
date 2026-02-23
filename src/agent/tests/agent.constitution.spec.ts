import { describe, expect, test } from 'bun:test'
import { behavioral } from '../../behavioral/behavioral.ts'
import { AGENT_EVENTS, RISK_CLASS } from '../agent.constants.ts'
import { classifyRisk, constitutionRule, createConstitution, createGateCheck } from '../agent.constitution.ts'
import type { ConstitutionRule } from '../agent.constitution.types.ts'
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

// ============================================================================
// createConstitution
// ============================================================================

describe('createConstitution', () => {
  const noBash: ConstitutionRule = {
    name: 'no_bash',
    description: 'Bash is disabled',
    test: (tc) => tc.name === 'bash',
  }

  const noSecrets: ConstitutionRule = {
    name: 'no_secrets',
    description: 'Cannot access secret files',
    test: (tc) => /\.(env|pem|key)$/.test(String(tc.arguments.path ?? '')),
  }

  test('gateCheck rejects tool calls matching a rule', () => {
    const { gateCheck } = createConstitution([noBash])
    const decision = gateCheck(makeToolCall('bash', { command: 'echo hi' }))
    expect(decision.approved).toBe(false)
    expect(decision.reason).toBe('Bash is disabled')
  })

  test('gateCheck approves tool calls not matching any rule', () => {
    const { gateCheck } = createConstitution([noBash])
    const decision = gateCheck(makeToolCall('read_file', { path: 'src/main.ts' }))
    expect(decision.approved).toBe(true)
  })

  test('gateCheck includes risk classification from classifyRisk', () => {
    const { gateCheck } = createConstitution([noBash])
    const approved = gateCheck(makeToolCall('write_file', { path: 'x.ts', content: '' }))
    expect(approved.riskClass).toBe(RISK_CLASS.side_effects)

    const rejected = gateCheck(makeToolCall('bash', { command: 'ls' }))
    expect(rejected.riskClass).toBe(RISK_CLASS.high_ambiguity)
  })

  test('gateCheck short-circuits on first matching rule', () => {
    let secondRuleCalled = false
    const rules: ConstitutionRule[] = [
      noBash,
      {
        name: 'second',
        test: () => {
          secondRuleCalled = true
          return true
        },
      },
    ]
    const { gateCheck } = createConstitution(rules)
    gateCheck(makeToolCall('bash', { command: 'ls' }))
    expect(secondRuleCalled).toBe(false)
  })

  test('returns named threads for each rule', () => {
    const { threads } = createConstitution([noBash, noSecrets])
    expect(threads).toHaveProperty('constitution_no_bash')
    expect(threads).toHaveProperty('constitution_no_secrets')
  })

  test('uses rule name as fallback reason when description is missing', () => {
    const rule: ConstitutionRule = { name: 'unnamed', test: () => true }
    const { gateCheck } = createConstitution([rule])
    const decision = gateCheck(makeToolCall('any_tool'))
    expect(decision.approved).toBe(false)
    expect(decision.reason).toBe('Blocked by rule: unnamed')
  })
})

// ============================================================================
// constitutionRule (config-driven utility)
// ============================================================================

describe('constitutionRule', () => {
  test('creates rule from blockedTools config', () => {
    const rule = constitutionRule({
      name: 'no_write_bash',
      blockedTools: ['write_file', 'bash'],
    })
    expect(rule.test(makeToolCall('bash', { command: 'ls' }))).toBe(true)
    expect(rule.test(makeToolCall('write_file', { path: 'x.ts' }))).toBe(true)
    expect(rule.test(makeToolCall('read_file', { path: 'x.ts' }))).toBe(false)
  })

  test('creates rule from pathPattern config', () => {
    const rule = constitutionRule({
      name: 'no_etc',
      pathPattern: '^\\/etc\\/',
    })
    expect(rule.test(makeToolCall('write_file', { path: '/etc/passwd' }))).toBe(true)
    expect(rule.test(makeToolCall('read_file', { path: '/app/config.ts' }))).toBe(false)
  })

  test('creates rule from argPattern config', () => {
    const rule = constitutionRule({
      name: 'no_rm_rf',
      argPattern: { key: 'command', pattern: 'rm\\s+-rf' },
    })
    expect(rule.test(makeToolCall('bash', { command: 'rm -rf /' }))).toBe(true)
    expect(rule.test(makeToolCall('bash', { command: 'ls -la' }))).toBe(false)
  })

  test('combines multiple config fields with OR logic', () => {
    const rule = constitutionRule({
      name: 'combined',
      blockedTools: ['delete_file'],
      pathPattern: '\\.env$',
    })
    // Matches blockedTools
    expect(rule.test(makeToolCall('delete_file', { path: '/app/main.ts' }))).toBe(true)
    // Matches pathPattern
    expect(rule.test(makeToolCall('read_file', { path: '/app/.env' }))).toBe(true)
    // Matches neither
    expect(rule.test(makeToolCall('read_file', { path: '/app/main.ts' }))).toBe(false)
  })
})

// ============================================================================
// createConstitution — BP integration
// ============================================================================

describe('createConstitution — BP integration', () => {
  test('constitution threads block execute events matching rules', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    const { threads } = createConstitution([
      {
        name: 'no_bash',
        test: (tc) => tc.name === 'bash',
      },
    ])
    bThreads.set(threads)

    useFeedback({
      [AGENT_EVENTS.execute](detail: { toolCall: AgentToolCall }) {
        log.push(`execute:${detail.toolCall.name}`)
      },
    })

    // Allowed: read_file
    trigger({
      type: AGENT_EVENTS.execute,
      detail: { toolCall: makeToolCall('read_file', { path: 'x.ts' }), riskClass: RISK_CLASS.read_only },
    })
    expect(log).toEqual(['execute:read_file'])

    // Blocked: bash
    trigger({
      type: AGENT_EVENTS.execute,
      detail: { toolCall: makeToolCall('bash', { command: 'ls' }), riskClass: RISK_CLASS.high_ambiguity },
    })
    expect(log).toEqual(['execute:read_file']) // no new entry
  })

  test('multiple rules compose additively — both block independently', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    const { threads } = createConstitution([
      { name: 'no_bash', test: (tc) => tc.name === 'bash' },
      {
        name: 'no_secrets',
        test: (tc) => /\.(env|pem|key)$/.test(String(tc.arguments.path ?? '')),
      },
    ])
    bThreads.set(threads)

    useFeedback({
      [AGENT_EVENTS.execute](detail: { toolCall: AgentToolCall }) {
        log.push(
          `execute:${detail.toolCall.name}:${detail.toolCall.arguments.path ?? detail.toolCall.arguments.command}`,
        )
      },
    })

    // Allowed: safe read
    trigger({
      type: AGENT_EVENTS.execute,
      detail: { toolCall: makeToolCall('read_file', { path: 'src/main.ts' }), riskClass: RISK_CLASS.read_only },
    })
    expect(log).toEqual(['execute:read_file:src/main.ts'])

    // Blocked by no_bash
    trigger({
      type: AGENT_EVENTS.execute,
      detail: { toolCall: makeToolCall('bash', { command: 'echo hi' }), riskClass: RISK_CLASS.high_ambiguity },
    })
    expect(log).toEqual(['execute:read_file:src/main.ts'])

    // Blocked by no_secrets
    trigger({
      type: AGENT_EVENTS.execute,
      detail: { toolCall: makeToolCall('read_file', { path: '/app/.env' }), riskClass: RISK_CLASS.read_only },
    })
    expect(log).toEqual(['execute:read_file:src/main.ts'])
  })

  test('rules added at runtime via bThreads.set block new patterns', () => {
    const log: string[] = []
    const { bThreads, trigger, useFeedback } = behavioral()

    // Start with one rule
    const result1 = createConstitution([{ name: 'no_bash', test: (tc) => tc.name === 'bash' }])
    bThreads.set(result1.threads)

    useFeedback({
      [AGENT_EVENTS.execute](detail: { toolCall: AgentToolCall }) {
        log.push(`execute:${detail.toolCall.name}`)
      },
    })

    // write_file allowed (no rule for it yet)
    trigger({
      type: AGENT_EVENTS.execute,
      detail: {
        toolCall: makeToolCall('write_file', { path: 'x.ts', content: '' }),
        riskClass: RISK_CLASS.side_effects,
      },
    })
    expect(log).toEqual(['execute:write_file'])

    // Add a new rule at runtime
    const result2 = createConstitution([{ name: 'no_writes', test: (tc) => tc.name === 'write_file' }])
    bThreads.set(result2.threads)

    // write_file now blocked
    trigger({
      type: AGENT_EVENTS.execute,
      detail: {
        toolCall: makeToolCall('write_file', { path: 'y.ts', content: '' }),
        riskClass: RISK_CLASS.side_effects,
      },
    })
    expect(log).toEqual(['execute:write_file']) // no new entry

    // bash still blocked from first rule
    trigger({
      type: AGENT_EVENTS.execute,
      detail: { toolCall: makeToolCall('bash', { command: 'ls' }), riskClass: RISK_CLASS.high_ambiguity },
    })
    expect(log).toEqual(['execute:write_file']) // still no new entry
  })
})
