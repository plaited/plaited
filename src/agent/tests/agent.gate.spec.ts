import { describe, expect, test } from 'bun:test'
import type { AgentToolCall, ConstitutionPredicate } from 'plaited'
import { composedGateCheck, isEtcWrite, isForcePush, isGovernanceModification, isRmRf, RISK_TAG } from 'plaited'

// ============================================================================
// Helpers
// ============================================================================

const bashCall = (command: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name: 'bash',
  arguments: { command },
})

const readCall = (path: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name: 'read_file',
  arguments: { path },
})

// ============================================================================
// Risk tag routing
// ============================================================================

describe('composedGateCheck — risk tag routing', () => {
  test('workspace-only tags route to execute', () => {
    const result = composedGateCheck({
      toolCall: readCall('/project/main.ts'),
      tags: [RISK_TAG.workspace],
    })
    expect(result.route).toBe('execute')
    expect(result.reason).toBeUndefined()
  })

  test('empty tags route to simulate (default-deny)', () => {
    const result = composedGateCheck({
      toolCall: bashCall('curl https://example.com'),
      tags: [],
    })
    expect(result.route).toBe('simulate')
  })

  test('mixed tags route to simulate', () => {
    const result = composedGateCheck({
      toolCall: bashCall('curl https://api.example.com'),
      tags: [RISK_TAG.workspace, RISK_TAG.outbound],
    })
    expect(result.route).toBe('simulate')
  })

  test('crosses_boundary tag routes to simulate', () => {
    const result = composedGateCheck({
      toolCall: bashCall('ssh remote-host'),
      tags: [RISK_TAG.crosses_boundary],
    })
    expect(result.route).toBe('simulate')
  })

  test('irreversible tag routes to simulate', () => {
    const result = composedGateCheck({
      toolCall: bashCall('drop table users;'),
      tags: [RISK_TAG.irreversible],
    })
    expect(result.route).toBe('simulate')
  })

  test('external_audience tag routes to simulate', () => {
    const result = composedGateCheck({
      toolCall: bashCall('gh pr create'),
      tags: [RISK_TAG.external_audience],
    })
    expect(result.route).toBe('simulate')
  })

  test('inbound tag routes to simulate', () => {
    const result = composedGateCheck({
      toolCall: bashCall('wget https://example.com/data'),
      tags: [RISK_TAG.inbound],
    })
    expect(result.route).toBe('simulate')
  })

  test('outbound tag routes to simulate', () => {
    const result = composedGateCheck({
      toolCall: bashCall('curl -X POST https://api.example.com'),
      tags: [RISK_TAG.outbound],
    })
    expect(result.route).toBe('simulate')
  })
})

// ============================================================================
// Constitution predicates
// ============================================================================

describe('composedGateCheck — constitution predicates', () => {
  const macPredicates: ConstitutionPredicate[] = [
    { name: 'noRmRf', check: isRmRf },
    { name: 'noEtcWrites', check: isEtcWrite },
    { name: 'noForcePush', check: isForcePush },
    { name: 'protectGovernance', check: isGovernanceModification },
  ]

  test('rejects when a constitution predicate matches', () => {
    const result = composedGateCheck(
      {
        toolCall: bashCall('rm -rf /'),
        tags: [RISK_TAG.workspace],
      },
      macPredicates,
    )
    expect(result.route).toBe('rejected')
    expect(result.reason).toBe('Blocked by noRmRf')
  })

  test('returns the first matching predicate name', () => {
    // /etc/ write also happens to be a bash command
    const result = composedGateCheck(
      {
        toolCall: bashCall('echo bad > /etc/passwd'),
        tags: [],
      },
      macPredicates,
    )
    expect(result.route).toBe('rejected')
    // noRmRf is first but doesn't match; noEtcWrites is second and does
    expect(result.reason).toBe('Blocked by noEtcWrites')
  })

  test('constitution check runs before tag routing', () => {
    // Even with workspace-only tags, constitution predicates reject first
    const result = composedGateCheck(
      {
        toolCall: bashCall('git push --force origin main'),
        tags: [RISK_TAG.workspace],
      },
      macPredicates,
    )
    expect(result.route).toBe('rejected')
    expect(result.reason).toBe('Blocked by noForcePush')
  })

  test('passes through when no predicates match', () => {
    const result = composedGateCheck(
      {
        toolCall: bashCall('ls -la'),
        tags: [RISK_TAG.workspace],
      },
      macPredicates,
    )
    expect(result.route).toBe('execute')
  })

  test('defaults to empty predicates when none provided', () => {
    const result = composedGateCheck({
      toolCall: bashCall('rm -rf /'),
      tags: [RISK_TAG.workspace],
    })
    // Without predicates, workspace-only tags route to execute
    expect(result.route).toBe('execute')
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('composedGateCheck — edge cases', () => {
  test('unknown tag values route to simulate', () => {
    const result = composedGateCheck({
      toolCall: readCall('/main.ts'),
      tags: ['unknown_tag'],
    })
    expect(result.route).toBe('simulate')
  })

  test('workspace + unknown tag routes to simulate', () => {
    const result = composedGateCheck({
      toolCall: readCall('/main.ts'),
      tags: [RISK_TAG.workspace, 'unknown_tag'],
    })
    expect(result.route).toBe('simulate')
  })

  test('multiple workspace tags (duplicated) route to execute', () => {
    // Duplicates in array are handled internally via Set
    const result = composedGateCheck({
      toolCall: readCall('/main.ts'),
      tags: [RISK_TAG.workspace, RISK_TAG.workspace],
    })
    expect(result.route).toBe('execute')
  })
})
