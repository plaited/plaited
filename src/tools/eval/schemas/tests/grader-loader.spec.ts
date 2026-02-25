import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { loadGrader } from '../grader-loader.ts'

const fixturesDir = join(import.meta.dir, 'fixtures')

// ============================================================================
// Module Graders (TypeScript/JavaScript)
// ============================================================================

describe('loadGrader - module graders', () => {
  test('loads TypeScript grader module', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-module.ts'))

    const result = await grader({
      input: 'What is 2+2?',
      output: 'The answer is 4',
      hint: '4',
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    expect(result.reasoning).toBe('Contains expected text')
  })

  test('fails when module does not export grade function', async () => {
    await expect(loadGrader(join(fixturesDir, 'grader-bad-module.ts'))).rejects.toThrow(
      "Grader module must export a 'grade' function",
    )
  })

  test('fails when module does not exist', async () => {
    await expect(loadGrader(join(fixturesDir, 'nonexistent.ts'))).rejects.toThrow('Grader not found')
  })
})

// ============================================================================
// Executable Graders (Python, etc.)
// ============================================================================

describe('loadGrader - executable graders', () => {
  test('loads and executes Python grader', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-exec.py'))

    const result = await grader({
      input: 'What is 2+2?',
      output: 'The answer is 4',
      hint: '4',
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    expect(result.reasoning).toBe('Contains expected')
  })

  test('Python grader returns pass=false when expected not in output', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-exec.py'))

    const result = await grader({
      input: 'What is 2+2?',
      output: 'I do not know',
      hint: '4',
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0.0)
  })

  test('throws when executable exits with non-zero code', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-exec-fail.py'))

    await expect(
      grader({
        input: 'test',
        output: 'test',
      }),
    ).rejects.toThrow('Grader exited with code 1')
  })

  test('throws when executable outputs invalid JSON', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-exec-invalid.py'))

    await expect(
      grader({
        input: 'test',
        output: 'test',
      }),
    ).rejects.toThrow('Grader output is not valid JSON')
  })

  test('fails when executable does not exist', async () => {
    await expect(loadGrader(join(fixturesDir, 'nonexistent.py'))).rejects.toThrow('Grader not found')
  })
})

// ============================================================================
// Extension Detection
// ============================================================================

describe('loadGrader - extension detection', () => {
  test('detects .ts as module', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-module.ts'))
    // If this doesn't throw, it was loaded as a module (not executed)
    expect(grader).toBeInstanceOf(Function)
  })

  test('detects .py as executable', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-exec.py'))
    expect(grader).toBeInstanceOf(Function)
  })
})

// ============================================================================
// Trajectory Support
// ============================================================================

describe('loadGrader - trajectory support', () => {
  test('passes trajectory to module grader', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-module.ts'))

    const trajectory = [
      { type: 'message' as const, content: 'Hello', timestamp: 0 },
      { type: 'tool_call' as const, name: 'read', status: 'completed', timestamp: 100 },
    ]

    const result = await grader({
      input: 'test',
      output: 'The answer is 4',
      hint: '4',
      trajectory,
    })

    expect(result.pass).toBe(true)
  })

  test('passes trajectory to executable grader', async () => {
    const grader = await loadGrader(join(fixturesDir, 'grader-exec.py'))

    const trajectory = [
      { type: 'message' as const, content: 'Hello', timestamp: 0 },
      { type: 'tool_call' as const, name: 'read', status: 'completed', timestamp: 100 },
    ]

    const result = await grader({
      input: 'test',
      output: 'The answer is 4',
      hint: '4',
      trajectory,
    })

    expect(result.pass).toBe(true)
  })
})
