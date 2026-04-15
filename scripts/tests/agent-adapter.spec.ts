import { afterEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

mock.module('../../src/cli/autoresearch/evaluation/run-module-scenarios.ts', () => ({
  runModuleScenarios: async ({ targetId }: { targetId: string }) => [
    {
      id: `${targetId}-mock-scenario`,
      pass: true,
      summary: 'Mock scenario pass.',
      snapshots: [],
      invariants: [{ id: 'mock-invariant', pass: true, reasoning: 'Mock invariant pass.' }],
      transport: {},
    },
  ],
}))

const { initAutoresearchLane, loadAutoresearchLaneStatus } = await import('../../src/cli/autoresearch/autoresearch.ts')
const {
  buildAgentStepPrompt,
  parseAgentAdapterArgs,
  runAgentAdapter,
  shouldAcceptAutoresearchEvaluation,
  substituteAgentCommand,
} = await import('../agent-adapter.ts')

describe('agent adapter helpers', () => {
  test('parses args and agent command after separator', () => {
    const parsed = parseAgentAdapterArgs([
      'bun',
      'scripts/agent-adapter.ts',
      '/tmp/lane',
      'dev-research/server-module/program.md',
      '/tmp/worktree',
      '--max-iterations',
      '2',
      '--min-score-delta',
      '0.1',
      '--',
      'bun',
      'run',
      '{{prompt_file}}',
    ])

    expect(parsed.maxIterations).toBe(2)
    expect(parsed.minScoreDelta).toBe(0.1)
    expect(parsed.agentCommand).toEqual(['bun', 'run', '{{prompt_file}}'])
  })

  test('substitutes adapter placeholders into the agent command', () => {
    const command = substituteAgentCommand({
      command: ['bun', 'runner.ts', '{{lane_dir}}', '{{iteration}}', '{{prompt_file}}', '{{target_id}}'],
      iteration: 3,
      laneDir: '/tmp/lane',
      programPath: 'dev-research/server-module/program.md',
      promptFile: '/tmp/lane/prompt.md',
      targetId: 'server-module',
      worktree: '/tmp/worktree',
    })

    expect(command).toEqual(['bun', 'runner.ts', '/tmp/lane', '3', '/tmp/lane/prompt.md', 'server-module'])
  })

  test('builds a prompt with writable-root and experiment guidance', () => {
    const prompt = buildAgentStepPrompt({
      iteration: 2,
      laneState: {
        runId: 'lane-1',
        laneDir: '/tmp/lane',
        programPath: 'dev-research/server-module/program.md',
        target: {
          kind: 'module',
          id: 'server-module',
          writableRoots: ['src/modules/server/'],
        },
        initializedAt: new Date().toISOString(),
        lastAcceptedIteration: 1,
        experiments: [
          {
            iteration: 1,
            pass: true,
            summary: 'ok',
            score: 1,
            changedPaths: ['src/modules/server/server-module.ts'],
            artifactDir: '/tmp/lane/experiments/iteration-001',
          },
        ],
      },
      programMarkdown: '# Program\n\nDo work.\n',
    })

    expect(prompt).toContain('Only edit files under: src/modules/server/')
    expect(prompt).toContain('Last accepted iteration: 1')
    expect(prompt).toContain('iteration 1: pass=true score=1 summary=ok')
    expect(prompt).toContain('# Program')
  })

  test('rejects no-op candidates and accepts first passing candidate with changes', () => {
    const laneState = {
      runId: 'lane-1',
      laneDir: '/tmp/lane',
      programPath: 'dev-research/server-module/program.md',
      target: {
        kind: 'module' as const,
        id: 'server-module',
      },
      initializedAt: new Date().toISOString(),
      experiments: [],
    }

    expect(
      shouldAcceptAutoresearchEvaluation({
        evaluation: {
          laneDir: '/tmp/lane',
          iteration: 1,
          programPath: laneState.programPath,
          target: laneState.target,
          pass: true,
          summary: 'ok',
          score: 1,
          changedPaths: [],
          artifactDir: '/tmp/lane/experiments/iteration-001',
        },
        laneState,
        minScoreDelta: 0,
      }),
    ).toEqual({
      accept: false,
      reason: 'candidate made no writable-root changes',
    })

    expect(
      shouldAcceptAutoresearchEvaluation({
        evaluation: {
          laneDir: '/tmp/lane',
          iteration: 1,
          programPath: laneState.programPath,
          target: laneState.target,
          pass: true,
          summary: 'ok',
          score: 1,
          changedPaths: ['src/modules/server/server-module.ts'],
          artifactDir: '/tmp/lane/experiments/iteration-001',
        },
        laneState,
        minScoreDelta: 0,
      }),
    ).toEqual({
      accept: true,
      reason: 'accepted first passing candidate with writable-root changes',
    })
  })
})

describe('runAgentAdapter', () => {
  let laneDir: string | undefined
  let mutableRootDir: string | undefined

  afterEach(() => {
    if (laneDir) {
      rmSync(laneDir, { recursive: true, force: true })
      laneDir = undefined
    }

    if (mutableRootDir) {
      rmSync(mutableRootDir, { recursive: true, force: true })
      mutableRootDir = undefined
    }
  })

  test('runs one agent step, evaluates it, and accepts the baseline update', async () => {
    laneDir = mkdtempSync(join(tmpdir(), 'plaited-agent-adapter-lane-'))
    mutableRootDir = mkdtempSync(join(process.cwd(), '.tmp-agent-adapter-'))
    const mutableRoot = relative(process.cwd(), mutableRootDir).replaceAll('\\', '/')
    const mutableFile = join(mutableRootDir, 'candidate.txt')

    await initAutoresearchLane({
      programPath: 'dev-research/server-module/program.md',
      target: {
        kind: 'module',
        id: 'server-module',
        writableRoots: [mutableRoot],
      },
      outputDir: laneDir,
    })

    const result = await runAgentAdapter({
      laneDir,
      programPath: 'dev-research/server-module/program.md',
      worktree: process.cwd(),
      maxConsecutiveRejects: 1,
      maxIterations: 1,
      minScoreDelta: 0,
      agentCommand: ['bun', '-e', 'await Bun.write(process.argv[1], "candidate")', mutableFile],
    })

    expect(result.acceptedIterations).toEqual([1])
    expect(result.rejectedIterations).toEqual([])
    expect(result.stopReason).toBe('hit max iterations (1)')
    expect(await Bun.file(mutableFile).text()).toBe('candidate')

    const laneState = await loadAutoresearchLaneStatus({
      laneDir,
    })

    expect(laneState.lastAcceptedIteration).toBe(1)
    expect(await Bun.file(join(laneDir, 'agent-adapter', 'iteration-001', 'prompt.md')).exists()).toBe(true)
    expect(await Bun.file(join(laneDir, 'agent-adapter', 'iteration-001', 'decision.json')).exists()).toBe(true)
  })
})
