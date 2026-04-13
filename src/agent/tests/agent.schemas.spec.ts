import { describe, expect, test } from 'bun:test'
import { type BashDetail, BashDetailSchema } from '../agent.schemas.ts'

describe('BashDetailSchema', () => {
  test('accepts required path and args', () => {
    const result = BashDetailSchema.parse({
      path: 'scripts/worker.ts',
      args: ['--flag', 'value'],
    }) satisfies BashDetail

    expect(result.path).toBe('scripts/worker.ts')
    expect(result.args).toEqual(['--flag', 'value'])
    expect(result.timeout).toBeUndefined()
  })

  test('accepts optional timeout', () => {
    const result = BashDetailSchema.parse({
      path: 'scripts/worker.ts',
      args: [],
      timeout: 5_000,
    })

    expect(result.timeout).toBe(5_000)
  })

  test('rejects missing path', () => {
    expect(() => BashDetailSchema.parse({ args: [] })).toThrow()
  })

  test('rejects non-array args', () => {
    expect(() =>
      BashDetailSchema.parse({
        path: 'scripts/worker.ts',
        args: '--help',
      }),
    ).toThrow()
  })
})
