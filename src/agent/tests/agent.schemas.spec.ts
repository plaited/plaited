import { describe, expect, test } from 'bun:test'
import {
  type BashDetail,
  BashDetailSchema,
  ToolBashApprovedDetailSchema,
  ToolBashDeniedDetailSchema,
  ToolBashRequestDetailSchema,
  ToolBashResultDetailSchema,
} from '../agent.schemas.ts'

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

  test('accepts optional workspace-relative cwd', () => {
    const result = BashDetailSchema.parse({
      path: 'scripts/worker.ts',
      args: [],
      cwd: 'src',
    })

    expect(result.cwd).toBe('src')
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

describe('ToolBashRequestDetailSchema', () => {
  test('accepts requestId, correlationId, and nested bash detail payload', () => {
    const result = ToolBashRequestDetailSchema.parse({
      requestId: 'req-1',
      correlationId: 'corr-1',
      bash: {
        path: 'scripts/worker.ts',
        args: ['--flag'],
        timeout: 1_000,
      } satisfies BashDetail,
    })

    expect(result).toEqual({
      requestId: 'req-1',
      correlationId: 'corr-1',
      bash: {
        path: 'scripts/worker.ts',
        args: ['--flag'],
        timeout: 1_000,
      },
    })
  })

  test('rejects missing requestId', () => {
    expect(() =>
      ToolBashRequestDetailSchema.parse({
        bash: {
          path: 'scripts/worker.ts',
          args: [],
        } satisfies BashDetail,
        correlationId: 'corr-1',
      }),
    ).toThrow()
  })
})

describe('ToolBashApprovedDetailSchema', () => {
  test('accepts requestId with optional correlationId', () => {
    const result = ToolBashApprovedDetailSchema.parse({
      requestId: 'req-2',
      correlationId: 'corr-2',
    })

    expect(result.requestId).toBe('req-2')
    expect(result.correlationId).toBe('corr-2')
  })

  test('rejects empty requestId', () => {
    expect(() =>
      ToolBashApprovedDetailSchema.parse({
        requestId: '',
      }),
    ).toThrow()
  })
})

describe('ToolBashDeniedDetailSchema', () => {
  test('accepts requestId with optional correlationId/reason', () => {
    const result = ToolBashDeniedDetailSchema.parse({
      requestId: 'req-3',
      correlationId: 'corr-3',
      reason: 'policy_denied',
    })

    expect(result).toEqual({
      requestId: 'req-3',
      correlationId: 'corr-3',
      reason: 'policy_denied',
    })
  })
})

describe('ToolBashResultDetailSchema', () => {
  test('accepts complete result payload', () => {
    const result = ToolBashResultDetailSchema.parse({
      requestId: 'req-4',
      correlationId: 'corr-4',
      exitCode: 0,
      stdout: 'ok',
      stderr: 'warn',
    })

    expect(result).toEqual({
      requestId: 'req-4',
      correlationId: 'corr-4',
      exitCode: 0,
      stdout: 'ok',
      stderr: 'warn',
    })
  })

  test('accepts nullable exitCode with error', () => {
    const result = ToolBashResultDetailSchema.parse({
      requestId: 'req-5',
      correlationId: 'corr-5',
      exitCode: null,
      stdout: '',
      stderr: '',
      stdoutTruncated: true,
      error: 'spawn failed',
    })

    expect(result.error).toBe('spawn failed')
    expect(result.exitCode).toBeNull()
    expect(result.stdoutTruncated).toBe(true)
  })

  test('rejects non-integer exitCode values', () => {
    expect(() =>
      ToolBashResultDetailSchema.parse({
        requestId: 'req-6',
        correlationId: 'corr-6',
        exitCode: 1.5,
        stdout: '',
        stderr: '',
      }),
    ).toThrow()
  })
})
