import { describe, expect, test } from 'bun:test'

import { adaptFindings } from '../adapt-findings.ts'

describe('adapt-findings script', () => {
  test('returns ok, findings, and warnings with best-effort normalization', async () => {
    const output = await adaptFindings({
      source: 'unit-test',
      input: [
        {
          kind: 'pattern',
          status: 'validated',
          summary: 'Boundary handlers emit diagnostics for denied execution.',
          evidence: [{ path: 'src/worker/worker.ts', line: 42, symbol: 'handleMessage' }],
        },
        {
          category: 'anti-pattern',
          text: 'Local try/catch hides runtime boundary failures.',
          evidence: [{ path: 'src/worker/worker.ts', line: 77 }],
        },
        {
          unexpected: true,
        },
      ],
    })

    expect(output.ok).toBe(true)
    expect(Array.isArray(output.findings)).toBe(true)
    expect(Array.isArray(output.warnings)).toBe(true)
    expect(output.findings.length).toBe(2)
    expect(output.findings[0]?.kind).toBe('pattern')
    expect(output.findings[0]?.status).toBe('validated')
    expect(output.findings[1]?.kind).toBe('anti-pattern')
    expect(output.findings[1]?.status).toBe('candidate')
    expect(output.warnings.length).toBe(1)
  })

  test('does not require database state and returns warning for empty payload', async () => {
    const output = await adaptFindings({
      source: 'unit-test',
      input: null,
    })

    expect(output.ok).toBe(true)
    expect(output.findings).toEqual([])
    expect(output.warnings.length).toBe(1)
    expect(output.warnings[0]).toContain('No adaptable finding-like entries')
  })

  test('downgrades validated/retired findings without evidence to candidate', async () => {
    const output = await adaptFindings({
      source: 'unit-test',
      input: [
        {
          kind: 'pattern',
          status: 'validated',
          summary: 'Validated finding with missing evidence.',
          evidence: [],
        },
        {
          kind: 'anti-pattern',
          status: 'retired',
          summary: 'Retired finding with missing evidence.',
        },
      ],
    })

    expect(output.ok).toBe(true)
    expect(output.findings).toHaveLength(2)
    expect(output.findings[0]?.status).toBe('candidate')
    expect(output.findings[1]?.status).toBe('candidate')
    expect(output.warnings).toHaveLength(2)
    expect(output.warnings[0]).toContain('Downgraded entry 0')
    expect(output.warnings[1]).toContain('Downgraded entry 1')
  })
})
