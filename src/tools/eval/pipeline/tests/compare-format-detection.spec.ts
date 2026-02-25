/**
 * Unit tests for compare format detection.
 *
 * @remarks
 * Tests for auto-detecting CaptureResult vs TrialResult format.
 *
 * @packageDocumentation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { detectAndValidateFormat, detectInputFormat } from '../compare-format-detection.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const CAPTURE_RESULT = JSON.stringify({
  id: 'test-001',
  input: 'Hello',
  output: 'Hi there',
  trajectory: [{ type: 'message', content: 'Hi', timestamp: 1234567890 }],
  timing: { start: 1234567890, end: 1234567891, total: 1, sessionCreation: 0 },
  metadata: {},
  toolErrors: false,
})

const TRIAL_RESULT = JSON.stringify({
  id: 'test-001',
  input: 'Hello',
  k: 3,
  passRate: 0.67,
  passAtK: 0.9,
  passExpK: 0.3,
  trials: [
    { trialNum: 1, output: 'Hi', trajectory: [], duration: 100, pass: true, score: 1.0 },
    { trialNum: 2, output: 'Hello', trajectory: [], duration: 120, pass: true, score: 0.8 },
    { trialNum: 3, output: 'Error', trajectory: [], duration: 150, pass: false, score: 0.2 },
  ],
})

const tempDir = `${import.meta.dir}/.test-tmp/format-detection`

beforeAll(async () => {
  await Bun.$`mkdir -p ${tempDir}`
})

afterAll(async () => {
  await Bun.$`rm -rf ${tempDir}`
})

// ============================================================================
// detectInputFormat Tests
// ============================================================================

describe('detectInputFormat', () => {
  test('detects CaptureResult format', async () => {
    const path = `${tempDir}/capture.jsonl`
    await Bun.write(path, `${CAPTURE_RESULT}\n`)

    const format = await detectInputFormat(path)

    expect(format).toBe('capture')
  })

  test('detects TrialResult format', async () => {
    const path = `${tempDir}/trial.jsonl`
    await Bun.write(path, `${TRIAL_RESULT}\n`)

    const format = await detectInputFormat(path)

    expect(format).toBe('trials')
  })

  test('throws on empty file', async () => {
    const path = `${tempDir}/empty.jsonl`
    await Bun.write(path, '')

    await expect(detectInputFormat(path)).rejects.toThrow('Empty file')
  })

  test('throws on invalid JSON', async () => {
    const path = `${tempDir}/invalid.jsonl`
    await Bun.write(path, 'not json\n')

    await expect(detectInputFormat(path)).rejects.toThrow('Invalid JSON')
  })

  test('throws on unrecognized format', async () => {
    const path = `${tempDir}/unknown.jsonl`
    await Bun.write(path, `${JSON.stringify({ id: 'test', foo: 'bar' })}\n`)

    await expect(detectInputFormat(path)).rejects.toThrow('Unable to detect format')
  })

  test('ignores empty lines and uses first non-empty line', async () => {
    const path = `${tempDir}/with-empty.jsonl`
    await Bun.write(path, `\n\n${CAPTURE_RESULT}\n`)

    const format = await detectInputFormat(path)

    expect(format).toBe('capture')
  })
})

// ============================================================================
// detectAndValidateFormat Tests
// ============================================================================

describe('detectAndValidateFormat', () => {
  test('validates all files have same format', async () => {
    const path1 = `${tempDir}/capture1.jsonl`
    const path2 = `${tempDir}/capture2.jsonl`
    await Bun.write(path1, `${CAPTURE_RESULT}\n`)
    await Bun.write(path2, `${CAPTURE_RESULT}\n`)

    const format = await detectAndValidateFormat([path1, path2])

    expect(format).toBe('capture')
  })

  test('throws on format mismatch', async () => {
    const capturePath = `${tempDir}/capture-mixed.jsonl`
    const trialPath = `${tempDir}/trial-mixed.jsonl`
    await Bun.write(capturePath, `${CAPTURE_RESULT}\n`)
    await Bun.write(trialPath, `${TRIAL_RESULT}\n`)

    await expect(detectAndValidateFormat([capturePath, trialPath])).rejects.toThrow('Format mismatch')
  })

  test('throws on empty file list', async () => {
    await expect(detectAndValidateFormat([])).rejects.toThrow('No files provided')
  })

  test('works with single file', async () => {
    const path = `${tempDir}/single-trial.jsonl`
    await Bun.write(path, `${TRIAL_RESULT}\n`)

    const format = await detectAndValidateFormat([path])

    expect(format).toBe('trials')
  })
})
