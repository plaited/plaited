import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { createValidationPlan } from '../factory-validate.ts'
import {
  buildJudgeInstruction,
  buildJudgePrompt,
  buildMetaVerifierPrompt,
  buildPlannerEnvironment,
  buildPromotionPrompt,
  normalizeReviewDecision,
  parseModelReview,
  parsePromotionResult,
  resolvePrograms,
  selectPromotionAttempt,
} from '../run-factory-programs.ts'
import { buildPiWorkerPrompt } from '../run-pi-factory-worker.ts'

describe('buildPiWorkerPrompt', () => {
  test('includes planner authority, program reference, and execution plan', () => {
    const prompt = buildPiWorkerPrompt({
      allowedPaths: ['src/factories/', 'src/factories.ts'],
      programMarkdown: '# Default Factories\n\n## Scope\n- [../../src/factories/](../../src/factories/)\n',
      planMarkdown: '1. Edit src/factories.ts\n2. Run bun test',
      planner: 'codex',
      programPath: 'dev-research/default-factories/program.md',
      retryGuidance: 'Only touch src/factories.ts',
    })

    expect(prompt).toContain("planning/orchestration authority is 'codex'")
    expect(prompt).toContain('@dev-research/default-factories/program.md')
    expect(prompt).toContain('Retry guidance:')
    expect(prompt).toContain('Only touch src/factories.ts')
    expect(prompt).toContain('Writable roots:')
    expect(prompt).toContain('src/factories/')
    expect(prompt).toContain('Lane program:')
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

describe('buildPlannerEnvironment', () => {
  test('strips secret and varlock-specific environment keys', () => {
    const result = buildPlannerEnvironment({
      HOME: '/tmp/home',
      OPENROUTER_API_KEY: 'secret',
      OP_SERVICE_ACCOUNT_TOKEN: 'op-secret',
      HF_TOKEN: 'hf-secret',
      YDC_API_KEY: 'ydc-secret',
      VARLOCK_SESSION_ID: 'abc123',
      PATH: '/usr/bin',
      PLAITED_AUTORESEARCH_PLANNER: 'codex',
    })

    expect(result.HOME).toBe('/tmp/home')
    expect(result.PATH).toBe('/usr/bin')
    expect(result.PLAITED_AUTORESEARCH_PLANNER).toBe('codex')
    expect(result.OPENROUTER_API_KEY).toBeUndefined()
    expect(result.OP_SERVICE_ACCOUNT_TOKEN).toBeUndefined()
    expect(result.HF_TOKEN).toBeUndefined()
    expect(result.YDC_API_KEY).toBeUndefined()
    expect(result.VARLOCK_SESSION_ID).toBeUndefined()
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
            formatExitCode: 0,
            typecheckExitCode: 0,
            targetedTestsExitCode: 0,
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
    expect(prompt).toContain('"formatExitCode": 0')
    expect(prompt).toContain('"typecheckExitCode": 0')
    expect(prompt).toContain('"targetedTestsExitCode": 0')
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

describe('review parsing', () => {
  test('normalizes review decision synonyms', () => {
    expect(normalizeReviewDecision('promote')).toBe('accept')
    expect(normalizeReviewDecision('promoted')).toBe('accept')
    expect(normalizeReviewDecision('deferred')).toBe('defer')
    expect(normalizeReviewDecision('rejected')).toBe('reject')
  })

  test('parses fenced review json with non-canonical decision labels', () => {
    const review = parseModelReview(
      '```json\n{"decision":"promoted","reasoning":"all checks passed"}\n```',
      'test-model',
    )

    expect(review).toEqual({
      decision: 'accept',
      reasoning: 'all checks passed',
    })
  })

  test('rejects unknown review decisions', () => {
    expect(() => parseModelReview('{"decision":"ship-it","reasoning":"nope"}', 'test-model')).toThrow(
      'Invalid review decision',
    )
  })
})

describe('review prompts', () => {
  test('uses canonical judge decision language', () => {
    const prompt = buildJudgeInstruction('{"lane":"server-factory"}')

    expect(prompt).toContain('accepted, deferred, or rejected')
    expect(prompt).toContain('decision must be exactly one of: accept, defer, reject')
  })

  test('builds meta-verifier prompt from judge and evidence', () => {
    const prompt = buildMetaVerifierPrompt({
      judge: {
        decision: 'defer',
        reasoning: 'needs more evidence',
      },
      evidence: {
        lane: 'server-factory',
        programPath: 'dev-research/server-factory/program.md',
        executionPlan: '# plan',
        programMarkdown: '# program',
        attempts: [],
      },
    })

    expect(prompt).toContain('"decision": "defer"')
    expect(prompt).toContain('"lane": "server-factory"')
  })
})

describe('promotion parsing', () => {
  test('parses promotion result json', () => {
    const result = parsePromotionResult(
      '{"decision":"accept","reasoning":"ported cleanly","changedPaths":["src/factories.ts"],"validation":["tsc ok"]}',
    )

    expect(result).toEqual({
      decision: 'accept',
      reasoning: 'ported cleanly',
      changedPaths: ['src/factories.ts'],
      validation: ['tsc ok'],
    })
  })

  test('normalizes non-canonical promotion decisions', () => {
    const result = parsePromotionResult('{"decision":"promoted","reasoning":"ported cleanly"}')

    expect(result.decision).toBe('accept')
  })
})

describe('promotion helpers', () => {
  test('selects the latest succeeded attempt for promotion', () => {
    const attempt = selectPromotionAttempt({
      lane: 'server-factory',
      programPath: 'dev-research/server-factory/program.md',
      runDir: '/tmp/run',
      attempts: [
        {
          attempt: 1,
          artifactDir: '/tmp/a1',
          status: 'failed',
          worktreePath: '/tmp/w1',
        },
        {
          attempt: 2,
          artifactDir: '/tmp/a2',
          status: 'succeeded',
          worktreePath: '/tmp/w2',
        },
        {
          attempt: 3,
          artifactDir: '/tmp/a3',
          status: 'succeeded',
          worktreePath: '/tmp/w3',
        },
      ],
    })

    expect(attempt?.attempt).toBe(3)
  })

  test('builds a promotion prompt with advisory reviews and candidate attempt context', async () => {
    const artifactDir = await mkdtemp('/tmp/factory-program-promotion-artifacts-')
    const runDir = await mkdtemp('/tmp/factory-program-promotion-run-')
    const worktreePath = await mkdtemp('/tmp/factory-program-promotion-worktree-')
    await Bun.write(join(artifactDir, 'worker.progress.log'), 'progress line\n')
    await Bun.write(join(artifactDir, 'targeted-tests.stderr.log'), 'tests stderr line\n')
    await Bun.write(join(artifactDir, 'diff-summary.txt'), 'M src/factories/server-factory/server-factory.ts\n')

    const prompt = await buildPromotionPrompt({
      judge: {
        decision: 'accept',
        reasoning: 'looks promising',
      },
      metaVerifier: {
        decision: 'defer',
        reasoning: 'double-check runtime semantics',
      },
      programPath: 'dev-research/server-factory/program.md',
      run: {
        lane: 'server-factory',
        programPath: 'dev-research/server-factory/program.md',
        runDir,
        attempts: [
          {
            attempt: 1,
            artifactDir,
            status: 'succeeded',
            worktreePath,
            changedPaths: ['src/factories/server-factory/server-factory.ts'],
          },
        ],
      },
    })

    expect(prompt).toContain('final promotion gate')
    expect(prompt).toContain('advisory only')
    expect(prompt).toContain('"decision": "accept"')
    expect(prompt).toContain('"decision": "defer"')
    expect(prompt).toContain('"attempt": 1')
    expect(prompt).toContain('"changedPaths": [')
  })
})

describe('createValidationPlan', () => {
  test('maps targeted tests for known lanes', async () => {
    const plan = await createValidationPlan({
      changedPaths: [],
      programPath: 'dev-research/server-factory/program.md',
    })

    expect(plan.reason).toContain("targeted tests mapped for lane 'server-factory'")
    expect(plan.commands).toContainEqual(['bun', '--bun', 'tsc', '--noEmit'])
    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/factories/server-factory/tests/server-factory.spec.ts',
      'src/factories/server-factory/tests/server.spec.ts',
    ])
  })

  test('infers factory-local tests from changed paths', async () => {
    const plan = await createValidationPlan({
      changedPaths: ['src/factories/server-factory/server-factory.ts'],
      programPath: 'dev-research/plan-factories/program.md',
    })

    expect(plan.reason).toContain("targeted tests mapped and inferred for lane 'plan-factories'")
    expect(plan.inferredTestFiles).toContain('src/factories/server-factory/tests/server-factory.spec.ts')
    expect(plan.inferredTestFiles).toContain('src/factories/server-factory/tests/server-factory.utils.spec.ts')
    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/factories/server-factory/tests/server-factory.spec.ts',
      'src/factories/server-factory/tests/server-factory.utils.spec.ts',
      'src/factories/server-factory/tests/server.spec.ts',
    ])
  })

  test('falls back to typecheck-only when no tests can be inferred', async () => {
    const plan = await createValidationPlan({
      changedPaths: ['src/factories/default-factory-bundle/default-factory-bundle.ts'],
      programPath: 'dev-research/plan-factories/program.md',
    })

    expect(plan.reason).toContain("no targeted tests inferred for lane 'plan-factories'")
    expect(plan.commands).toEqual([['bun', '--bun', 'tsc', '--noEmit']])
  })

  test('covers bootstrap tests for default-factories lane', async () => {
    const plan = await createValidationPlan({
      changedPaths: [],
      programPath: 'dev-research/default-factories/program.md',
    })

    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/agent/tests/create-agent.spec.ts',
      'src/bootstrap/tests/bootstrap.spec.ts',
      'src/cli/program-runner/tests/program-runner.spec.ts',
    ])
  })
})
