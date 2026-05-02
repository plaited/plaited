import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const createTempRoot = (): string =>
  join('/tmp', `plaited-eval-tests-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const withTempRoot = async (run: (rootDir: string) => Promise<void>): Promise<void> => {
  const rootDir = createTempRoot()
  await Bun.$`mkdir -p ${rootDir}`

  try {
    await run(rootDir)
  } finally {
    await Bun.$`rm -rf ${rootDir}`
  }
}

const runPlaitedCommand = async (args: string[]) =>
  Bun.$`bun ./bin/plaited.ts ${args}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const runEvalCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts eval ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

const createTrial = ({
  cwd,
  id,
  result = {
    status: 'completed',
    message: 'ok',
  },
  snapshots = [],
  taskId,
}: {
  cwd: string
  id: string
  result?: { status: string; message?: string }
  snapshots?: unknown[]
  taskId: string
}) => ({
  id,
  cwd,
  task: {
    id: taskId,
    prompt: `prompt ${taskId}`,
  },
  result,
  snapshots,
})

const createProcessSummary = () => ({
  snapshotCount: 0,
  selectionCount: 0,
  runtimeErrorCount: 0,
  feedbackErrorCount: 0,
  deadlockCount: 0,
  workerFailureCount: 0,
  repeatedSelectionCount: 0,
  maxRepeatedSelectionTypeCount: 0,
  runtimeErrorDetected: false,
  feedbackErrorDetected: false,
  deadlockDetected: false,
  workerFailureDetected: false,
})

const createTrialResult = ({
  cwd,
  id,
  pass,
  score,
  taskId,
}: {
  cwd: string
  id: string
  pass: boolean
  score: number
  taskId: string
}) => ({
  mode: 'grade',
  trial: createTrial({ cwd, id, taskId }),
  process: createProcessSummary(),
  graderResults: [],
  pass,
  score,
})

describe('eval CLI', () => {
  test('plaited --schema includes eval and excludes research', async () => {
    const result = await runPlaitedCommand(['--schema'])

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString())
    expect(output.commands).toContain('eval')
    expect(output.commands).not.toContain('research')
  })

  test('plaited eval --schema input emits the eval input schema', async () => {
    const result = await runPlaitedCommand(['eval', '--schema', 'input'])

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString())
    expect(output.description).toContain('Top-level plaited eval input schema')
    expect(output.oneOf.length).toBe(2)
  })

  test('mode=grade rejects empty grader lists at the CLI boundary', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({ cwd: rootDir, id: 'trial-empty-graders', taskId: 'task-empty-graders' }),
        graders: [],
      })

      expect(result.exitCode).toBe(2)
      expect(result.stderr.toString()).toContain('graders')
    })
  })

  test('mode=grade returns process diagnostics derived from snapshots', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({
          cwd: rootDir,
          id: 'trial-process',
          taskId: 'task-process',
          snapshots: [
            {
              kind: 'selection',
              step: 0,
              selected: {
                type: 'alpha',
              },
            },
            {
              kind: 'selection',
              step: 1,
              selected: {
                type: 'alpha',
              },
            },
            {
              kind: 'selection',
              step: 2,
              selected: {
                type: 'beta',
              },
            },
            {
              kind: 'feedback_error',
              type: 'alpha',
              error: 'handler failed',
            },
            {
              kind: 'deadlock',
              step: 3,
            },
            {
              kind: 'runtime_error',
              error: 'runtime panic',
            },
            {
              kind: 'worker',
              response: {
                id: 'worker-1',
                exitCode: 1,
                timedOut: false,
                signalCode: null,
              },
            },
          ],
        }),
        graders: [
          {
            id: 'process-1',
            type: 'process',
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.pass).toBe(false)
      expect(output.process.snapshotCount).toBe(7)
      expect(output.process.selectionCount).toBe(3)
      expect(output.process.feedbackErrorCount).toBe(1)
      expect(output.process.deadlockCount).toBe(1)
      expect(output.process.runtimeErrorCount).toBe(1)
      expect(output.process.workerFailureCount).toBe(1)
      expect(output.process.repeatedSelectionCount).toBe(1)
      expect(output.process.maxRepeatedSelectionTypeCount).toBe(2)
      expect(output.process.feedbackErrorDetected).toBe(true)
      expect(output.process.deadlockDetected).toBe(true)
      expect(output.process.runtimeErrorDetected).toBe(true)
      expect(output.process.workerFailureDetected).toBe(true)
    })
  })

  test('mode=grade combines process and json graders for completed trials', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({ cwd: rootDir, id: 'trial-process-json', taskId: 'task-process-json' }),
        graders: [
          {
            id: 'process-1',
            type: 'process',
          },
          {
            id: 'json-1',
            type: 'json',
            result: {
              pass: true,
              score: 0.5,
              reasoning: 'external judge pass',
            },
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.mode).toBe('grade')
      expect(output.pass).toBe(true)
      expect(output.score).toBe(0.75)
      expect(output.graderResults).toHaveLength(2)
      expect(output.graderResults[0].pass).toBe(true)
      expect(output.graderResults[1].pass).toBe(true)
    })
  })

  test('mode=grade forces terminal non-success statuses to fail while retaining skipped graders', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({
          cwd: rootDir,
          id: 'trial-failed',
          result: {
            status: 'failed',
          },
          taskId: 'task-failed',
        }),
        graders: [
          {
            id: 'json-always',
            type: 'json',
            result: {
              pass: true,
              score: 1,
            },
          },
          {
            id: 'json-completed-only',
            type: 'json',
            when: 'completed',
            result: {
              pass: true,
              score: 1,
            },
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.pass).toBe(false)
      expect(output.score).toBe(0)
      expect(output.graderResults[0].skipped).toBe(false)
      expect(output.graderResults[1].skipped).toBe(true)
    })
  })

  test('mode=grade runs command graders in trial.cwd for exit_code output', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({ cwd: rootDir, id: 'trial-cmd-exit', taskId: 'task-cmd-exit' }),
        graders: [
          {
            id: 'cmd-exit',
            type: 'command',
            options: {
              command: ['bun', '-e', "await Bun.write('cli-cmd-grader.txt', 'ok'); process.exit(0);"],
              output: 'exit_code',
            },
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.pass).toBe(true)
      expect(output.graderResults[0].pass).toBe(true)

      const exists = await Bun.file(join(rootDir, 'cli-cmd-grader.txt')).exists()
      expect(exists).toBe(true)
    })
  })

  test('mode=grade fails command grader_json output when stdout is invalid JSON', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({ cwd: rootDir, id: 'trial-cmd-json-invalid', taskId: 'task-cmd-json-invalid' }),
        graders: [
          {
            id: 'cmd-json-invalid',
            type: 'command',
            options: {
              command: ['bun', '-e', "console.log('not-json')"],
              output: 'grader_json',
            },
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.pass).toBe(false)
      expect(output.score).toBe(0)
      expect(output.graderResults[0].pass).toBe(false)
      expect(output.graderResults[0].reasoning).toContain('valid JSON')
    })
  })

  test('mode=grade passes prior grader results to later command graders on stdin', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({ cwd: rootDir, id: 'trial-previous-results', taskId: 'task-previous-results' }),
        graders: [
          {
            id: 'first-json',
            type: 'json',
            result: {
              pass: true,
              score: 1,
            },
          },
          {
            id: 'reads-previous-results',
            type: 'command',
            options: {
              command: [
                'bun',
                '-e',
                [
                  'const input = await Bun.stdin.json();',
                  'const previous = input.previousResults;',
                  'console.log(JSON.stringify({',
                  '  pass: previous.length === 1 && previous[0].id === "first-json",',
                  '  score: previous.length === 1 ? 1 : 0,',
                  '  reasoning: "previousResults=" + previous.length',
                  '}));',
                ].join(' '),
              ],
              output: 'grader_json',
            },
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.pass).toBe(true)
      expect(output.graderResults[1].pass).toBe(true)
      expect(output.graderResults[1].reasoning).toBe('previousResults=1')
    })
  })

  test('mode=grade converts command spawn failures into failed grader results', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'grade',
        trial: createTrial({ cwd: rootDir, id: 'trial-missing-command', taskId: 'task-missing-command' }),
        graders: [
          {
            id: 'cmd-missing',
            type: 'command',
            options: {
              command: ['plaited-eval-missing-command'],
              output: 'exit_code',
            },
          },
        ],
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.pass).toBe(false)
      expect(output.score).toBe(0)
      expect(output.graderResults[0].pass).toBe(false)
      expect(output.graderResults[0].reasoning).toContain('failed to execute')
    })
  })

  test('mode=compare returns per-task rows and summary counts', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'compare',
        k: 2,
        baseline: {
          label: 'baseline',
          tasks: [
            {
              taskId: 'task-a',
              trials: [
                createTrialResult({ cwd: rootDir, id: 'ba-1', taskId: 'task-a', pass: true, score: 0.9 }),
                createTrialResult({ cwd: rootDir, id: 'ba-2', taskId: 'task-a', pass: false, score: 0.2 }),
              ],
            },
            {
              taskId: 'task-b',
              trials: [createTrialResult({ cwd: rootDir, id: 'bb-1', taskId: 'task-b', pass: false, score: 0.1 })],
            },
          ],
        },
        challenger: {
          label: 'challenger',
          tasks: [
            {
              taskId: 'task-a',
              trials: [createTrialResult({ cwd: rootDir, id: 'ca-1', taskId: 'task-a', pass: true, score: 0.95 })],
            },
            {
              taskId: 'task-c',
              trials: [createTrialResult({ cwd: rootDir, id: 'cc-1', taskId: 'task-c', pass: true, score: 0.8 })],
            },
          ],
        },
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.mode).toBe('compare')
      expect(output.summary.totalTasks).toBe(3)
      expect(output.summary.comparableTasks).toBe(1)
      expect(output.summary.insufficientData).toBe(2)

      const taskA = output.perTask.find((row: { taskId: string }) => row.taskId === 'task-a')
      expect(taskA).toBeDefined()
      expect(taskA.baselineTrialCount).toBe(2)
      expect(taskA.challengerTrialCount).toBe(1)
      expect(taskA.comparable).toBe(true)
      expect(taskA.winner).toBe('challenger')
      expect(output.baseline.metrics.estimatedPassAtK).toBeDefined()
      expect(output.baseline.metrics.estimatedPassAllK).toBeDefined()
      expect(output.challenger.metrics.estimatedPassAtK).toBeDefined()
      expect(output.challenger.metrics.estimatedPassAllK).toBeDefined()
    })
  })

  test('mode=compare fails when taskId does not match trials[].trial.task.id', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'compare',
        baseline: {
          label: 'baseline',
          tasks: [
            {
              taskId: 'task-x',
              trials: [createTrialResult({ cwd: rootDir, id: 'bx-1', taskId: 'task-y', pass: true, score: 1 })],
            },
          ],
        },
        challenger: {
          label: 'challenger',
          tasks: [],
        },
      })

      expect(result.exitCode).toBe(1)
      expect(result.stderr.toString()).toContain('does not match taskId')
    })
  })

  test('mode=compare uses pass rate before average score when selecting task winners', async () => {
    await withTempRoot(async (rootDir) => {
      const result = await runEvalCommand({
        mode: 'compare',
        baseline: {
          label: 'baseline',
          tasks: [
            {
              taskId: 'task-score-tie-break',
              trials: [
                createTrialResult({
                  cwd: rootDir,
                  id: 'b-1',
                  taskId: 'task-score-tie-break',
                  pass: true,
                  score: 0.6,
                }),
                createTrialResult({
                  cwd: rootDir,
                  id: 'b-2',
                  taskId: 'task-score-tie-break',
                  pass: true,
                  score: 0.6,
                }),
              ],
            },
          ],
        },
        challenger: {
          label: 'challenger',
          tasks: [
            {
              taskId: 'task-score-tie-break',
              trials: [
                createTrialResult({
                  cwd: rootDir,
                  id: 'c-1',
                  taskId: 'task-score-tie-break',
                  pass: true,
                  score: 1,
                }),
                createTrialResult({
                  cwd: rootDir,
                  id: 'c-2',
                  taskId: 'task-score-tie-break',
                  pass: false,
                  score: 1,
                }),
              ],
            },
          ],
        },
      })

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString())
      expect(output.perTask[0].winner).toBe('baseline')
      expect(output.summary.baselineWins).toBe(1)
      expect(output.summary.challengerWins).toBe(0)
    })
  })
})
