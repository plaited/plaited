import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { resolveRelativePath } from '../resolve-relative-path.ts'

describe('resolveRelativePath', () => {
  test('resolves a path inside cwd', () => {
    const cwd = '/tmp/onbraid-worker'
    const path = 'nested/file.txt'

    expect(resolveRelativePath({ cwd, path })).toBe(resolve(cwd, path))
  })

  test('rejects absolute input paths', () => {
    expect(() =>
      resolveRelativePath({
        cwd: '/tmp/onbraid-worker',
        path: '/etc/passwd',
      }),
    ).toThrow('Expected path to be relative to cwd: /etc/passwd')
  })

  test('rejects paths that escape cwd', () => {
    expect(() =>
      resolveRelativePath({
        cwd: '/tmp/onbraid-worker',
        path: '../outside.txt',
      }),
    ).toThrow('Path escapes cwd: ../outside.txt')
  })
})
