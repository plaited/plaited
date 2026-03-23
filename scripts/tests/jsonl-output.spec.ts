import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appendJsonlRow, appendJsonlRows, resetJsonlOutput } from '../jsonl-output.ts'

describe('jsonl-output', () => {
  test('resets and appends jsonl rows incrementally', async () => {
    const outputPath = join(tmpdir(), `plaited-jsonl-output-${Date.now()}.jsonl`)

    await resetJsonlOutput(outputPath)
    await appendJsonlRow(outputPath, { id: 'row-1', value: 1 })
    await appendJsonlRows(outputPath, [
      { id: 'row-2', value: 2 },
      { id: 'row-3', value: 3 },
    ])

    const text = await Bun.file(outputPath).text()
    expect(text).toBe(
      `${JSON.stringify({ id: 'row-1', value: 1 })}\n` +
        `${JSON.stringify({ id: 'row-2', value: 2 })}\n` +
        `${JSON.stringify({ id: 'row-3', value: 3 })}\n`,
    )
  })
})
