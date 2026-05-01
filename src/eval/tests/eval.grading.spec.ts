import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { gradeEvalTrial } from '../eval.grading.ts'
import { EvalGradeInputSchema, EvalTrialSchema } from '../eval.schemas.ts'

let tempDir = ''

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'plaited-eval-grading-'))
})

afterAll(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true })
  }
})

const makeTrial = ({
  status,
  message,
}: {
  status: 'completed' | 'failed' | 'timed_out' | 'cancelled'
  message?: string
}) => {
  return EvalTrialSchema.parse({
    id: `trial-${status}`,
    cwd: tempDir || '/tmp',
    task: {
      id: 'task-1',
      prompt: 'prompt',
    },
    result: status === 'completed' ? { status, message: message ?? 'ok' } : { status, message },
    snapshots: [],
  })
}

describe('gradeEvalTrial', () => {
  test('requires at least one grader', () => {
    const parsed = EvalGradeInputSchema.safeParse({
      mode: 'grade',
      trial: makeTrial({ status: 'completed', message: 'finished' }),
      graders: [],
    })

    expect(parsed.success).toBe(false)
  })

  test('grades with process and json graders on completed trials', async () => {
    const input = EvalGradeInputSchema.parse({
      mode: 'grade',
      trial: makeTrial({ status: 'completed', message: 'finished' }),
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

    const output = await gradeEvalTrial(input)

    expect(output.pass).toBe(true)
    expect(output.score).toBe(0.75)
    expect(output.graderResults).toHaveLength(2)
    expect(output.graderResults[0]?.pass).toBe(true)
    expect(output.graderResults[1]?.pass).toBe(true)
  })

  test('forces overall failure and score=0 for terminal non-success statuses while still grading', async () => {
    const input = EvalGradeInputSchema.parse({
      mode: 'grade',
      trial: makeTrial({ status: 'failed' }),
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

    const output = await gradeEvalTrial(input)

    expect(output.pass).toBe(false)
    expect(output.score).toBe(0)
    expect(output.graderResults[0]?.skipped).toBe(false)
    expect(output.graderResults[1]?.skipped).toBe(true)
  })

  test('runs command grader in trial.cwd for exit_code output', async () => {
    const mutatedPath = join(tempDir, 'grader-mutated.txt')
    const input = EvalGradeInputSchema.parse({
      mode: 'grade',
      trial: makeTrial({ status: 'completed', message: 'done' }),
      graders: [
        {
          id: 'cmd-exit',
          type: 'command',
          options: {
            command: ['bun', '-e', "await Bun.write('grader-mutated.txt', 'ok'); process.exit(0);"],
            output: 'exit_code',
          },
        },
      ],
    })

    const output = await gradeEvalTrial(input)
    const exists = await Bun.file(mutatedPath).exists()

    expect(output.pass).toBe(true)
    expect(output.graderResults[0]?.pass).toBe(true)
    expect(exists).toBe(true)
  })

  test('fails command grader_json output when stdout is invalid JSON', async () => {
    const input = EvalGradeInputSchema.parse({
      mode: 'grade',
      trial: makeTrial({ status: 'completed', message: 'done' }),
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

    const output = await gradeEvalTrial(input)

    expect(output.pass).toBe(false)
    expect(output.score).toBe(0)
    expect(output.graderResults[0]?.pass).toBe(false)
    expect(output.graderResults[0]?.reasoning).toContain('valid JSON')
  })

  test('passes prior grader results to later command graders on stdin', async () => {
    const input = EvalGradeInputSchema.parse({
      mode: 'grade',
      trial: makeTrial({ status: 'completed', message: 'done' }),
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

    const output = await gradeEvalTrial(input)

    expect(output.pass).toBe(true)
    expect(output.graderResults[1]?.pass).toBe(true)
    expect(output.graderResults[1]?.reasoning).toBe('previousResults=1')
  })

  test('converts command spawn failures into failed grader results', async () => {
    const input = EvalGradeInputSchema.parse({
      mode: 'grade',
      trial: makeTrial({ status: 'completed', message: 'done' }),
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

    const output = await gradeEvalTrial(input)

    expect(output.pass).toBe(false)
    expect(output.score).toBe(0)
    expect(output.graderResults[0]?.pass).toBe(false)
    expect(output.graderResults[0]?.reasoning).toContain('failed to execute')
  })
})
