import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

let tempDir = ''

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'plaited-eval-cli-'))
})

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
  }
})

const makeTrial = ({ id, taskId, cwd }: { id: string; taskId: string; cwd: string }) => ({
  id,
  cwd,
  task: {
    id: taskId,
    prompt: `prompt ${taskId}`,
  },
  result: {
    status: 'completed',
    message: 'ok',
  },
  snapshots: [],
})

const makeTrialResult = ({
  id,
  taskId,
  pass,
  score,
}: {
  id: string
  taskId: string
  pass: boolean
  score: number
}) => ({
  mode: 'grade',
  trial: makeTrial({ id, taskId, cwd: tempDir || '/tmp' }),
  process: {
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
  },
  graderResults: [],
  pass,
  score,
})

describe('eval CLI smoke tests', () => {
  test('plaited --schema includes eval and excludes research', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.commands).toContain('eval')
    expect(output.commands).not.toContain('research')
  })

  test('plaited eval --schema input emits the eval input schema', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts eval --schema input`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.description).toContain('Top-level plaited eval input schema')
    expect(output.oneOf.length).toBe(2)
  })

  test('grade with process/json graders', async () => {
    const payload = JSON.stringify({
      mode: 'grade',
      trial: makeTrial({ id: 'trial-pj', taskId: 'task-pj', cwd: tempDir }),
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
          },
        },
      ],
    })

    const result = await Bun.$`bun ./bin/plaited.ts eval ${payload}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.mode).toBe('grade')
    expect(output.pass).toBe(true)
    expect(output.score).toBe(0.75)
  })

  test('grade with command exit_code grader', async () => {
    const payload = JSON.stringify({
      mode: 'grade',
      trial: makeTrial({ id: 'trial-cmd-exit', taskId: 'task-cmd-exit', cwd: tempDir }),
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

    const result = await Bun.$`bun ./bin/plaited.ts eval ${payload}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.pass).toBe(true)
    expect(output.graderResults[0].pass).toBe(true)

    const exists = await Bun.file(join(tempDir, 'cli-cmd-grader.txt')).exists()
    expect(exists).toBe(true)
  })

  test('grade with command grader_json invalid JSON failure', async () => {
    const payload = JSON.stringify({
      mode: 'grade',
      trial: makeTrial({ id: 'trial-cmd-json', taskId: 'task-cmd-json', cwd: tempDir }),
      graders: [
        {
          id: 'cmd-json',
          type: 'command',
          options: {
            command: ['bun', '-e', "console.log('not-json')"],
            output: 'grader_json',
          },
        },
      ],
    })

    const result = await Bun.$`bun ./bin/plaited.ts eval ${payload}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.pass).toBe(false)
    expect(output.graderResults[0].pass).toBe(false)
  })

  test('compare baseline/challenger bundles', async () => {
    const payload = JSON.stringify({
      mode: 'compare',
      k: 2,
      baseline: {
        label: 'baseline',
        tasks: [
          {
            taskId: 'task-a',
            trials: [
              makeTrialResult({ id: 'ba-1', taskId: 'task-a', pass: true, score: 0.9 }),
              makeTrialResult({ id: 'ba-2', taskId: 'task-a', pass: false, score: 0.1 }),
            ],
          },
          {
            taskId: 'task-b',
            trials: [makeTrialResult({ id: 'bb-1', taskId: 'task-b', pass: false, score: 0.2 })],
          },
        ],
      },
      challenger: {
        label: 'challenger',
        tasks: [
          {
            taskId: 'task-a',
            trials: [makeTrialResult({ id: 'ca-1', taskId: 'task-a', pass: true, score: 0.95 })],
          },
        ],
      },
    })

    const result = await Bun.$`bun ./bin/plaited.ts eval ${payload}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.mode).toBe('compare')
    expect(output.summary.totalTasks).toBe(2)
    expect(output.summary.comparableTasks).toBe(1)
    expect(output.summary.insufficientData).toBe(1)
  })
})
