import { describe, expect, test } from 'bun:test'
import { createValidationPlan } from '../factory-validate.ts'
import { buildJudgePrompt, resolvePrograms } from '../run-factory-programs.ts'
import { buildPiWorkerPrompt } from '../run-pi-factory-worker.ts'

describe('buildPiWorkerPrompt', () => {
  test('includes planner authority and program reference', () => {
    const prompt = buildPiWorkerPrompt({
      planner: 'codex',
      programPath: 'dev-research/default-factories/program.md',
    })

    expect(prompt).toContain("planning/orchestration authority is 'codex'")
    expect(prompt).toContain('@dev-research/default-factories/program.md')
  })
})

describe('resolvePrograms', () => {
  test('returns explicit program override unchanged', () => {
    const programs = resolvePrograms({
      programs: ['dev-research/default-factories/program.md'],
    })

    expect(programs).toEqual(['dev-research/default-factories/program.md'])
  })

  test('resolves named phase', () => {
    const programs = resolvePrograms({
      phase: 'integration',
    })

    expect(programs).toContain('dev-research/default-factories/program.md')
    expect(programs).toContain('dev-research/agent-bootstrap/program.md')
  })
})

describe('buildJudgePrompt', () => {
  test('includes attempt summaries and program markdown', async () => {
    const worktreePath = process.cwd()
    const prompt = await buildJudgePrompt({
      programPath: 'dev-research/default-factories/program.md',
      run: {
        lane: 'default-factories',
        programPath: 'dev-research/default-factories/program.md',
        runDir: '/tmp/run',
        attempts: [
          {
            attempt: 1,
            artifactDir: '/tmp/run/attempt-01',
            status: 'succeeded',
            worktreePath,
            workerExitCode: 0,
            validateExitCode: 0,
          },
        ],
      },
    })

    expect(prompt).toContain('"lane": "default-factories"')
    expect(prompt).toContain('"attempt": 1')
    expect(prompt).toContain('Default Factories')
  })
})

describe('createValidationPlan', () => {
  test('maps targeted tests for known lanes', () => {
    const plan = createValidationPlan('dev-research/server-factory/program.md')

    expect(plan.reason).toContain("targeted tests mapped for lane 'server-factory'")
    expect(plan.commands).toContainEqual(['bun', '--bun', 'tsc', '--noEmit'])
    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/factories/server-factory/tests/server-factory.spec.ts',
      'src/factories/server-factory/tests/server.spec.ts',
    ])
  })

  test('falls back to typecheck-only for unmapped lanes', () => {
    const plan = createValidationPlan('dev-research/plan-factories/program.md')

    expect(plan.reason).toContain("no explicit targeted tests mapped for lane 'plan-factories'")
    expect(plan.commands).toEqual([['bun', '--bun', 'tsc', '--noEmit']])
  })
})
