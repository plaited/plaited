import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { createValidationPlan } from '../factory-validate.ts'
import { buildJudgePrompt, resolvePrograms } from '../run-factory-programs.ts'
import { buildPiWorkerPrompt } from '../run-pi-factory-worker.ts'

describe('buildPiWorkerPrompt', () => {
  test('includes planner authority, program reference, and execution plan', () => {
    const prompt = buildPiWorkerPrompt({
      planMarkdown: '1. Edit src/factories.ts\n2. Run bun test',
      planner: 'codex',
      programPath: 'dev-research/default-factories/program.md',
      retryGuidance: 'Only touch src/factories.ts',
    })

    expect(prompt).toContain("planning/orchestration authority is 'codex'")
    expect(prompt).toContain('@dev-research/default-factories/program.md')
    expect(prompt).toContain('Retry guidance:')
    expect(prompt).toContain('Only touch src/factories.ts')
    expect(prompt).toContain('Execution plan:')
    expect(prompt).toContain('Edit src/factories.ts')
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
  test('includes attempt summaries, artifacts, and program markdown', async () => {
    const worktreePath = await mkdtemp('/tmp/factory-program-worktree-')
    const artifactDir = await mkdtemp('/tmp/factory-program-scripts-')
    const runDir = await mkdtemp('/tmp/factory-program-run-')
    await mkdir(join(worktreePath, 'src'), { recursive: true })
    await mkdir(artifactDir, { recursive: true })
    await Bun.write(join(artifactDir, 'pi.stdout.log'), 'worker stdout line\n')
    await Bun.write(join(artifactDir, 'pi.stderr.log'), 'worker stderr line\n')
    await Bun.write(join(artifactDir, 'worker.progress.log'), 'progress line\n')
    await Bun.write(join(artifactDir, 'validate.stderr.log'), 'validate stderr line\n')
    await Bun.write(join(artifactDir, 'format.stdout.log'), 'format stdout line\n')
    await Bun.write(join(artifactDir, 'typecheck.stderr.log'), 'typecheck stderr line\n')
    await Bun.write(join(artifactDir, 'targeted-tests.stdout.log'), 'tests stdout line\n')
    await Bun.write(join(worktreePath, 'src', 'factories.ts'), 'export const generated = true\n')
    await Bun.write(join(runDir, 'execution-plan.md'), '# Execution Plan\n\n1. Edit src/factories.ts\n')

    const prompt = await buildJudgePrompt({
      programPath: 'dev-research/default-factories/program.md',
      run: {
        lane: 'default-factories',
        programPath: 'dev-research/default-factories/program.md',
        runDir,
        attempts: [
          {
            attempt: 1,
            artifactDir,
            status: 'succeeded',
            worktreePath,
            workerExitCode: 0,
            validateExitCode: 0,
            changedPaths: ['src/factories.ts'],
          },
        ],
      },
    })

    expect(prompt).toContain('"lane": "default-factories"')
    expect(prompt).toContain('"attempt": 1')
    expect(prompt).toContain('Default Factories')
    expect(prompt).toContain('"executionPlan": "# Execution Plan')
    expect(prompt).toContain('"workerStdout": "worker stdout line"')
    expect(prompt).toContain('"workerStderr": "worker stderr line"')
    expect(prompt).toContain('"workerProgress": "progress line"')
    expect(prompt).toContain('"validateStderr": "validate stderr line"')
    expect(prompt).toContain('"formatStdout": "format stdout line"')
    expect(prompt).toContain('"typecheckStderr": "typecheck stderr line"')
    expect(prompt).toContain('"targetedTestsStdout": "tests stdout line"')
    expect(prompt).toContain('"changedPaths": [')
    expect(prompt).toContain('"changedFileExcerpts": [')
    expect(prompt).toContain('"path": "src/factories.ts"')
    expect(prompt).toContain('export const generated = true')
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

  test('covers bootstrap tests for default-factories lane', () => {
    const plan = createValidationPlan('dev-research/default-factories/program.md')

    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/agent/tests/create-agent.spec.ts',
      'src/bootstrap/tests/bootstrap.spec.ts',
      'src/cli/program-runner/tests/program-runner.spec.ts',
    ])
  })
})
