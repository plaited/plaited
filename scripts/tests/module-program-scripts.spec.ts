import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { createValidationPlan } from '../module-validate.ts'
import {
  buildJudgeInstruction,
  buildJudgePrompt,
  buildMetaVerifierPrompt,
  buildPiAgentEnvironment,
  buildPromotionPrompt,
  normalizeReviewDecision,
  parseModelReview,
  parsePromotionResult,
  resolvePlannerKind,
  resolvePrograms,
  runWithConcurrencyLimit,
  selectPromotionAttempt,
} from '../run-module-programs.ts'
import { buildPiWorkerPrompt } from '../run-pi-module-worker.ts'
import { recordPiSessionEvent, writePiAgentArtifacts } from '../run-pi-orchestrator-agent.ts'

describe('buildPiWorkerPrompt', () => {
  test('includes planner authority, program reference, and execution plan', () => {
    const prompt = buildPiWorkerPrompt({
      allowedPaths: ['src/modules/', 'src/modules.ts'],
      programMarkdown: '# Default Modules\n\n## Scope\n- [../../src/modules/](../../src/modules/)\n',
      planMarkdown: '1. Edit src/modules.ts\n2. Run bun test',
      planner: 'pi',
      programPath: 'dev-research/default-modules/program.md',
      retryGuidance: 'Only touch src/modules.ts',
    })

    expect(prompt).toContain("planning/orchestration authority is 'pi'")
    expect(prompt).toContain('@dev-research/default-modules/program.md')
    expect(prompt).toContain('Retry guidance:')
    expect(prompt).toContain('Only touch src/modules.ts')
    expect(prompt).toContain('Writable roots:')
    expect(prompt).toContain('src/modules/')
    expect(prompt).toContain('Lane program:')
    expect(prompt).toContain('Execution plan:')
    expect(prompt).toContain('Edit src/modules.ts')
    expect(prompt).toContain(
      'After the first substantive edit, run the narrow formatting, type checking, and targeted test commands',
    )
    expect(prompt).toContain('Do not claim validation succeeded unless you actually ran the commands in this worktree')
  })
})

describe('resolvePrograms', () => {
  test('returns explicit program override unchanged', () => {
    const programs = resolvePrograms({
      programs: ['dev-research/default-modules/program.md'],
    })

    expect(programs).toEqual(['dev-research/default-modules/program.md'])
  })

  test('resolves named phase', () => {
    const programs = resolvePrograms({
      phase: 'integration',
    })

    expect(programs).toContain('dev-research/default-modules/program.md')
    expect(programs).toContain('dev-research/agent-bootstrap/program.md')
  })
})

describe('runWithConcurrencyLimit', () => {
  test('runs multiple program lanes concurrently up to the configured limit', async () => {
    const started: number[] = []
    const released: number[] = []
    const resolvers = new Map<number, () => void>()
    let active = 0
    let maxActive = 0

    const runPromise = runWithConcurrencyLimit({
      items: [1, 2, 3],
      limit: 2,
      worker: async (item) => {
        started.push(item)
        active += 1
        maxActive = Math.max(maxActive, active)
        await new Promise<void>((resolve) => {
          resolvers.set(item, resolve)
        })
        released.push(item)
        active -= 1
        return item * 10
      },
    })

    await Bun.sleep(20)
    expect(started).toEqual([1, 2])
    expect(maxActive).toBe(2)

    resolvers.get(1)?.()
    await Bun.sleep(20)
    expect(started).toEqual([1, 2, 3])

    resolvers.get(2)?.()
    resolvers.get(3)?.()
    expect(await runPromise).toEqual([10, 20, 30])
    expect(released).toEqual([1, 2, 3])
  })
})

describe('pi orchestration helpers', () => {
  test('strips unrelated secrets from pi agent subprocess environment', () => {
    const result = buildPiAgentEnvironment({
      HOME: '/tmp/home',
      OPENROUTER_API_KEY: 'secret',
      OP_SERVICE_ACCOUNT_TOKEN: 'op-secret',
      HF_TOKEN: 'hf-secret',
      YDC_API_KEY: 'ydc-secret',
      VARLOCK_SESSION_ID: 'abc123',
      PATH: '/usr/bin',
      PLAITED_AUTORESEARCH_PLANNER: 'pi',
      PLAITED_PLANNING_MODEL: 'xiaomi/mimo-v2-pro',
    })

    expect(result.HOME).toBe('/tmp/home')
    expect(result.PATH).toBe('/usr/bin')
    expect(result.OPENROUTER_API_KEY).toBe('secret')
    expect(result.PLAITED_PLANNING_MODEL).toBe('xiaomi/mimo-v2-pro')
    expect(result.HF_TOKEN).toBeUndefined()
    expect(result.OP_SERVICE_ACCOUNT_TOKEN).toBeUndefined()
    expect(result.YDC_API_KEY).toBeUndefined()
    expect(result.VARLOCK_SESSION_ID).toBeUndefined()
  })

  test('rejects unsupported planner selections', () => {
    expect(resolvePlannerKind(undefined)).toBe('pi')
    expect(resolvePlannerKind('pi')).toBe('pi')
    expect(() => resolvePlannerKind('codex')).toThrow("Unsupported planner 'codex'")
  })

  test('records auto-retry events in wrapper stderr logs', () => {
    const buffers = {
      messageChunks: [],
      stdoutChunks: [],
      stderrChunks: [],
    }

    recordPiSessionEvent({
      buffers,
      event: {
        type: 'auto_retry_start',
        attempt: 2,
        maxAttempts: 4,
        errorMessage: 'rate limited',
      },
    })
    recordPiSessionEvent({
      buffers,
      event: {
        type: 'auto_retry_end',
        success: false,
        finalError: 'still rate limited',
      },
    })

    expect(buffers.stderrChunks.join('')).toContain('[auto-retry:start] attempt=2/4 rate limited')
    expect(buffers.stderrChunks.join('')).toContain('[auto-retry:end] success=false still rate limited')
  })

  test('writes wrapper artifacts even when there is only stderr output', async () => {
    const artifactDir = await mkdtemp('/tmp/pi-orchestrator-agent-artifacts-')
    const outputFile = join(artifactDir, 'output.txt')
    const stdoutFile = join(artifactDir, 'stdout.log')
    const stderrFile = join(artifactDir, 'stderr.log')

    await writePiAgentArtifacts({
      buffers: {
        messageChunks: [],
        stdoutChunks: [],
        stderrChunks: ['model resolution failed\n'],
      },
      outputFile,
      stdoutFile,
      stderrFile,
    })

    expect(await Bun.file(outputFile).text()).toBe('')
    expect(await Bun.file(stdoutFile).text()).toBe('')
    expect(await Bun.file(stderrFile).text()).toBe('model resolution failed\n')
  })
})

describe('buildJudgePrompt', () => {
  test('includes attempt summaries, artifacts, and program markdown', async () => {
    const worktreePath = await mkdtemp('/tmp/module-program-worktree-')
    const artifactDir = await mkdtemp('/tmp/module-program-scripts-')
    const runDir = await mkdtemp('/tmp/module-program-run-')
    await mkdir(join(worktreePath, 'src'), { recursive: true })
    await mkdir(artifactDir, { recursive: true })
    await Bun.write(join(artifactDir, 'pi.stdout.log'), 'worker stdout line\n')
    await Bun.write(join(artifactDir, 'pi.stderr.log'), 'worker stderr line\n')
    await Bun.write(join(artifactDir, 'worker.progress.log'), 'progress line\n')
    await Bun.write(join(artifactDir, 'validate.stderr.log'), 'validate stderr line\n')
    await Bun.write(join(artifactDir, 'format.stdout.log'), 'format stdout line\n')
    await Bun.write(join(artifactDir, 'typecheck.stderr.log'), 'typecheck stderr line\n')
    await Bun.write(join(artifactDir, 'targeted-tests.stdout.log'), 'tests stdout line\n')
    await Bun.write(join(worktreePath, 'src', 'modules.ts'), 'export const generated = true\n')
    await Bun.write(join(runDir, 'execution-plan.md'), '# Execution Plan\n\n1. Edit src/modules.ts\n')

    const prompt = await buildJudgePrompt({
      programPath: 'dev-research/default-modules/program.md',
      run: {
        lane: 'default-modules',
        programPath: 'dev-research/default-modules/program.md',
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
            changedPaths: ['src/modules.ts'],
          },
        ],
      },
    })

    expect(prompt).toContain('"lane": "default-modules"')
    expect(prompt).toContain('"attempt": 1')
    expect(prompt).toContain('Default Modules')
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
    expect(prompt).toContain('"path": "src/modules.ts"')
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
    const prompt = buildJudgeInstruction('{"lane":"server-module"}')

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
        lane: 'server-module',
        programPath: 'dev-research/server-module/program.md',
        executionPlan: '# plan',
        programMarkdown: '# program',
        attempts: [],
      },
    })

    expect(prompt).toContain('"decision": "defer"')
    expect(prompt).toContain('"lane": "server-module"')
  })
})

describe('promotion parsing', () => {
  test('parses promotion result json', () => {
    const result = parsePromotionResult(
      '{"decision":"accept","reasoning":"ported cleanly","changedPaths":["src/modules.ts"],"validation":["tsc ok"]}',
    )

    expect(result).toEqual({
      decision: 'accept',
      reasoning: 'ported cleanly',
      changedPaths: ['src/modules.ts'],
      validation: ['tsc ok'],
    })
  })

  test('normalizes non-canonical promotion decisions', () => {
    const result = parsePromotionResult('{"decision":"promoted","reasoning":"ported cleanly"}')

    expect(result.decision).toBe('accept')
  })

  test('parses promotion json wrapped in prose', () => {
    const result = parsePromotionResult(
      'Promotion review complete.\n{"decision":"defer","reasoning":"needs another pass","changedPaths":[],"validation":[]}',
    )

    expect(result.decision).toBe('defer')
    expect(result.reasoning).toBe('needs another pass')
  })
})

describe('promotion helpers', () => {
  test('selects the latest succeeded attempt for promotion', () => {
    const attempt = selectPromotionAttempt({
      lane: 'server-module',
      programPath: 'dev-research/server-module/program.md',
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
    const artifactDir = await mkdtemp('/tmp/module-program-promotion-artifacts-')
    const runDir = await mkdtemp('/tmp/module-program-promotion-run-')
    const worktreePath = await mkdtemp('/tmp/module-program-promotion-worktree-')
    await Bun.write(join(artifactDir, 'worker.progress.log'), 'progress line\n')
    await Bun.write(join(artifactDir, 'targeted-tests.stderr.log'), 'tests stderr line\n')
    await Bun.write(join(artifactDir, 'diff-summary.txt'), 'M src/modules/server-module/server-module.ts\n')

    const prompt = await buildPromotionPrompt({
      judge: {
        decision: 'accept',
        reasoning: 'looks promising',
      },
      metaVerifier: {
        decision: 'defer',
        reasoning: 'double-check runtime semantics',
      },
      programPath: 'dev-research/server-module/program.md',
      run: {
        lane: 'server-module',
        programPath: 'dev-research/server-module/program.md',
        runDir,
        attempts: [
          {
            attempt: 1,
            artifactDir,
            status: 'succeeded',
            worktreePath,
            changedPaths: ['src/modules/server-module/server-module.ts'],
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
      programPath: 'dev-research/server-module/program.md',
    })

    expect(plan.reason).toContain("targeted tests mapped for lane 'server-module'")
    expect(plan.commands).toContainEqual(['bun', '--bun', 'tsc', '--noEmit'])
    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/modules/server-module/tests/server-module.spec.ts',
      'src/modules/server-module/tests/server.spec.ts',
    ])
  })

  test('infers module-local tests from changed paths', async () => {
    const plan = await createValidationPlan({
      changedPaths: ['src/modules/server-module/server-module.ts'],
      programPath: 'dev-research/plan-modules/program.md',
    })

    expect(plan.reason).toContain("targeted tests mapped and inferred for lane 'plan-modules'")
    expect(plan.inferredTestFiles).toContain('src/modules/server-module/tests/server-module.spec.ts')
    expect(plan.inferredTestFiles).toContain('src/modules/server-module/tests/server-module.utils.spec.ts')
    expect(plan.commands).toContainEqual([
      'bun',
      'test',
      'src/modules/server-module/tests/server-module.spec.ts',
      'src/modules/server-module/tests/server-module.utils.spec.ts',
      'src/modules/server-module/tests/server.spec.ts',
    ])
  })

  test('falls back to typecheck-only when no tests can be inferred', async () => {
    const plan = await createValidationPlan({
      changedPaths: ['src/modules/default-module-bundle/default-module-bundle.ts'],
      programPath: 'dev-research/plan-modules/program.md',
    })

    expect(plan.reason).toContain("no targeted tests inferred for lane 'plan-modules'")
    expect(plan.commands).toEqual([['bun', '--bun', 'tsc', '--noEmit']])
  })

  test('covers bootstrap tests for default-modules lane', async () => {
    const plan = await createValidationPlan({
      changedPaths: [],
      programPath: 'dev-research/default-modules/program.md',
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
