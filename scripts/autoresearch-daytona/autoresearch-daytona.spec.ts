import { describe, expect, test } from 'bun:test'
import type { FRONTIER_STATUS } from '../../src/behavioral/behavioral.constants.ts'
import type { Thread } from '../../src/behavioral/behavioral.types.ts'
import { PROGRESSIVE_DISCLOSURE_THREAD } from '../../src/kernel/threads.ts'
import type { FrontierStateNode } from '../../src/tools/frontier.ts'
import {
  buildGateScript,
  extractPathFromTrace,
  formatContrast,
  formatStory,
  formatSummary,
  type SandboxGateResult,
} from './autoresearch-daytona.ts'

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

// Minimal trace fixtures matching the real frontierExplore state graph shape.
// Each node has: stateKey, frontier { status }, step, successors [{ selection: { type }, to }].
const makeTrace = (
  nodes: Array<{ step: number; status: string; successors: Array<{ type: string; to: number }> }>,
): Record<string, FrontierStateNode> => {
  const graph: Record<string, FrontierStateNode> = {}
  nodes.forEach((n, i) => {
    const key = `node-${i}`
    graph[key] = {
      stateKey: key,
      frontier: { status: n.status as keyof typeof FRONTIER_STATUS, candidates: [], enabled: [] },
      step: n.step,
      successors: n.successors.map((s) => ({
        selection: { type: s.type, priority: 0, space: 'daytona-demo', ingress: true },
        to: `node-${s.to}`,
      })),
    } as FrontierStateNode
  })
  return graph
}

// Good thread trace: user.prompt → discovery.search → discovery.results → model.respond → model.result → skill.read → tool.loaded → turn.end
const GOOD_TRACE = makeTrace([
  { step: 0, status: 'idle', successors: [{ type: 'user.prompt', to: 1 }] },
  { step: 1, status: 'ready', successors: [{ type: 'discovery.search', to: 2 }] },
  {
    step: 2,
    status: 'idle',
    successors: [
      { type: 'discovery.results', to: 3 },
      { type: 'turn.end', to: 4 },
    ],
  },
  { step: 3, status: 'ready', successors: [{ type: 'model.respond', to: 5 }] },
  { step: 3, status: 'idle', successors: [] },
  {
    step: 4,
    status: 'idle',
    successors: [
      { type: 'model.result', to: 6 },
      { type: 'turn.end', to: 4 },
    ],
  },
  { step: 5, status: 'ready', successors: [{ type: 'skill.read', to: 7 }] },
  {
    step: 6,
    status: 'idle',
    successors: [
      { type: 'tool.loaded', to: 8 },
      { type: 'turn.end', to: 4 },
    ],
  },
  {
    step: 7,
    status: 'ready',
    successors: [
      { type: 'turn.end', to: 4 },
      { type: 'turn.end', to: 4 },
    ],
  },
])

// Broken thread trace: user.prompt → model.respond → model.result → skill.read → tool.loaded → turn.end (no discovery.search)
const BROKEN_TRACE = makeTrace([
  { step: 0, status: 'idle', successors: [{ type: 'user.prompt', to: 1 }] },
  { step: 1, status: 'ready', successors: [{ type: 'model.respond', to: 2 }] },
  {
    step: 2,
    status: 'idle',
    successors: [
      { type: 'model.result', to: 3 },
      { type: 'turn.end', to: 4 },
    ],
  },
  { step: 3, status: 'ready', successors: [{ type: 'skill.read', to: 5 }] },
  { step: 3, status: 'idle', successors: [] },
  {
    step: 4,
    status: 'idle',
    successors: [
      { type: 'tool.loaded', to: 6 },
      { type: 'turn.end', to: 4 },
    ],
  },
  {
    step: 5,
    status: 'ready',
    successors: [
      { type: 'turn.end', to: 4 },
      { type: 'turn.end', to: 4 },
    ],
  },
])

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

describe('extractPathFromTrace', () => {
  test('KEEP: extracts the winning path (root → terminal idle with both phases)', () => {
    const path = extractPathFromTrace(GOOD_TRACE, true)
    expect(path).toContain('user.prompt')
    expect(path).toContain('discovery.search')
    expect(path).toContain('skill.read')
    expect(path).toContain('turn.end')
    // The path should be a readable arrow-joined sequence
    expect(path).toContain('→')
  })

  test('DISCARD: extracts the longest path when no winning path exists', () => {
    const path = extractPathFromTrace(BROKEN_TRACE, false)
    expect(path).toContain('user.prompt')
    expect(path).toContain('model.respond')
    expect(path).toContain('skill.read')
    // Broken thread has no discovery.search — the path should not contain it
    expect(path).not.toContain('discovery.search')
  })

  test('empty trace returns empty string', () => {
    const path = extractPathFromTrace({}, false)
    expect(path).toBe('')
  })
})

describe('formatContrast', () => {
  test('KEEP: shows before/after with the missing step identified', () => {
    const contrast = formatContrast(BROKEN_THREAD, PROGRESSIVE_DISCLOSURE_THREAD)
    expect(contrast).toContain('before')
    expect(contrast).toContain('after')
    expect(contrast).toContain('progressive-disclosure-broken (6 rules)')
    expect(contrast).toContain('progressive-disclosure (8 rules)')
    // The difference: broken is missing discovery.search
    expect(contrast).toContain('discovery.search')
  })

  test('identical threads: shows no difference', () => {
    const contrast = formatContrast(PROGRESSIVE_DISCLOSURE_THREAD, PROGRESSIVE_DISCLOSURE_THREAD)
    expect(contrast).toContain('before')
    expect(contrast).toContain('after')
    // Same label + rule count
    expect(contrast).toContain('progressive-disclosure (8 rules)')
  })
})

describe('formatStory', () => {
  test('KEEP: renders contrast + explored path + verdict', () => {
    const story = formatStory(
      {
        iterations: [
          {
            iteration: 0,
            candidate: PROGRESSIVE_DISCLOSURE_THREAD,
            verifyStatus: 'verified',
            targetReached: true,
            kept: true,
            trace: GOOD_TRACE,
          },
        ],
      },
      'demo:autoresearch',
      BROKEN_THREAD,
    )
    // Contrast
    expect(story).toContain('before')
    expect(story).toContain('after')
    expect(story).toContain('progressive-disclosure-broken (6 rules)')
    expect(story).toContain('progressive-disclosure (8 rules)')
    // Explored path
    expect(story).toContain('the gate explored')
    expect(story).toContain('user.prompt')
    expect(story).toContain('discovery.search')
    expect(story).toContain('→')
    expect(story).toContain('reached the goal')
    // Verdict
    expect(story).toContain('safety')
    expect(story).toContain('verified')
    expect(story).toContain('verdict')
    expect(story).toContain('KEEP')
    // No raw trace blob
    expect(story).not.toContain('stateKey')
  })

  test('DISCARD: renders contrast + explored path + discard reason', () => {
    const story = formatStory(
      {
        iterations: [
          {
            iteration: 0,
            candidate: BROKEN_THREAD,
            verifyStatus: 'verified',
            targetReached: false,
            kept: false,
            trace: BROKEN_TRACE,
          },
        ],
      },
      'fork-isolation',
      BROKEN_THREAD,
    )
    expect(story).toContain('before')
    expect(story).toContain('the gate explored')
    expect(story).toContain('user.prompt')
    // The path should not include discovery.search as an explored edge
    // (the broken thread has no search step)
    expect(story).toContain('DISCARD')
    expect(story).toContain('no discovery.search')
  })

  test('multiple iterations: winning path full + prior discards summarized', () => {
    const story = formatStory(
      {
        iterations: [
          {
            iteration: 0,
            candidate: BROKEN_THREAD,
            verifyStatus: 'verified',
            targetReached: false,
            kept: false,
            trace: BROKEN_TRACE,
          },
          {
            iteration: 1,
            candidate: PROGRESSIVE_DISCLOSURE_THREAD,
            verifyStatus: 'verified',
            targetReached: true,
            kept: true,
            trace: GOOD_TRACE,
          },
        ],
      },
      'demo:autoresearch:model',
      BROKEN_THREAD,
    )
    // Prior discard summarized
    expect(story).toContain('iter 0')
    expect(story).toContain('DISCARD')
    // Winning iteration full story
    expect(story).toContain('KEEP')
    expect(story).toContain('the gate explored')
  })

  test('all discards (no promote): shows each iteration verdict plainly', () => {
    const story = formatStory(
      {
        iterations: [
          {
            iteration: 0,
            candidate: BROKEN_THREAD,
            verifyStatus: 'verified',
            targetReached: false,
            kept: false,
            trace: BROKEN_TRACE,
          },
          {
            iteration: 1,
            candidate: BROKEN_THREAD,
            verifyStatus: 'verified',
            targetReached: false,
            kept: false,
            trace: BROKEN_TRACE,
          },
        ],
      },
      'demo:autoresearch:model',
      BROKEN_THREAD,
    )
    expect(story).toContain('iter 0')
    expect(story).toContain('iter 1')
    expect(story).toContain('DISCARD')
    expect(story).toContain('No candidate passed the gate')
  })
})

describe('formatSummary', () => {
  test('KEEP verdict: shows two-part gate lines + verdict', () => {
    const summary = formatSummary(
      {
        iterations: [
          {
            iteration: 0,
            candidate: PROGRESSIVE_DISCLOSURE_THREAD,
            verifyStatus: 'verified',
            targetReached: true,
            kept: true,
            trace: {},
          },
        ],
      },
      'demo:autoresearch',
    )
    expect(summary).toContain('iteration 0')
    expect(summary).toContain('candidate : progressive-disclosure (8 rules)')
    expect(summary).toContain('safety    : verified')
    expect(summary).toContain('useful    : target reached')
    expect(summary).toContain('verdict   : KEEP')
    // No trace blob in the summary
    expect(summary).not.toContain('stateKey')
  })

  test('DISCARD verdict: shows reason when target not reached', () => {
    const summary = formatSummary(
      {
        iterations: [
          {
            iteration: 0,
            candidate: BROKEN_THREAD,
            verifyStatus: 'verified',
            targetReached: false,
            kept: false,
            trace: {},
          },
        ],
      },
      'demo:autoresearch',
    )
    expect(summary).toContain('verdict   : DISCARD')
    expect(summary).toContain('target not reached')
  })

  test('DISCARD verdict: shows safety failure when verifyStatus is not verified', () => {
    const summary = formatSummary(
      {
        iterations: [
          {
            iteration: 0,
            candidate: BROKEN_THREAD,
            verifyStatus: 'rejected',
            targetReached: false,
            kept: false,
            trace: {},
          },
        ],
      },
      'demo:autoresearch',
    )
    expect(summary).toContain('verdict   : DISCARD')
    expect(summary).toContain('safety gate failed')
  })

  test('multiple iterations: each gets its own block', () => {
    const summary = formatSummary(
      {
        iterations: [
          {
            iteration: 0,
            candidate: BROKEN_THREAD,
            verifyStatus: 'verified',
            targetReached: false,
            kept: false,
            trace: {},
          },
          {
            iteration: 1,
            candidate: PROGRESSIVE_DISCLOSURE_THREAD,
            verifyStatus: 'verified',
            targetReached: true,
            kept: true,
            trace: {},
          },
        ],
      },
      'demo:autoresearch',
    )
    expect(summary).toContain('iteration 0')
    expect(summary).toContain('iteration 1')
    expect(summary).toContain('DISCARD')
    expect(summary).toContain('KEEP')
  })
})
