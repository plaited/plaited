import { describe, expect, test } from 'bun:test'
import type { Thread } from '../../src/behavioral/behavioral.types.ts'
import { PROGRESSIVE_DISCLOSURE_THREAD } from '../../src/kernel/threads.ts'
import { buildGateScript, type SandboxGateResult } from './autoresearch-daytona.ts'

const BROKEN_THREAD: Thread = {
  label: 'progressive-disclosure-broken',
  once: true,
  rules: [
    { waitFor: [{ type: 'user.prompt' }] },
    { request: { type: 'model.respond' } },
    { waitFor: [{ type: 'model.result' }], interrupt: [{ type: 'turn.end' }] },
    { request: { type: 'skill.read' } },
    { waitFor: [{ type: 'tool.loaded' }], interrupt: [{ type: 'turn.end' }] },
    { request: { type: 'turn.end' } },
  ],
}

const TRIGGERS = [
  { type: 'user.prompt', space: 'daytona-demo' },
  { type: 'discovery.results', space: 'daytona-demo' },
  { type: 'model.result', space: 'daytona-demo' },
  { type: 'tool.loaded', space: 'daytona-demo' },
  { type: 'turn.end', space: 'daytona-demo' },
]

describe('buildGateScript', () => {
  test('produces a self-contained TS script that imports the gate and prints JSON', () => {
    const script = buildGateScript({
      candidate: PROGRESSIVE_DISCLOSURE_THREAD,
      triggers: TRIGGERS,
      maxDepth: 20,
      space: 'daytona-demo',
    })

    expect(script).toContain('gateCandidate')
    expect(script).toContain('PROGRESSIVE_DISCLOSURE_THREAD')
    expect(script).toContain('console.log')
    // Progressive-disclosure thread is imported, not inlined
    expect(script).toContain('PROGRESSIVE_DISCLOSURE_THREAD')
    expect(script).not.toContain(JSON.stringify(PROGRESSIVE_DISCLOSURE_THREAD).slice(0, 50))
  })

  test('embeds the candidate thread JSON when it is not the progressive-disclosure thread', () => {
    const script = buildGateScript({
      candidate: BROKEN_THREAD,
      triggers: TRIGGERS,
      maxDepth: 20,
      space: 'daytona-demo',
    })

    expect(script).toContain('gateCandidate')
    expect(script).toContain(JSON.stringify(BROKEN_THREAD).slice(0, 50))
    expect(script).not.toContain('PROGRESSIVE_DISCLOSURE_THREAD')
  })
})

describe('SandboxGateResult', () => {
  test('a passing gate result has kept=true', () => {
    const result: SandboxGateResult = {
      verifyStatus: 'verified',
      targetReached: true,
      kept: true,
      trace: {},
    }
    expect(result.kept).toBe(true)
  })

  test('a failing gate result has kept=false', () => {
    const result: SandboxGateResult = {
      verifyStatus: 'verified',
      targetReached: false,
      kept: false,
      trace: {},
    }
    expect(result.kept).toBe(false)
  })
})
