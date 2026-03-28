import { describe, expect, test } from 'bun:test'
import { isAllowedWorkspacePath, parseAllowedRoots, resolveWithinWorkspace } from '../pi-worktree-guard-extension.ts'

describe('pi-worktree-guard-extension', () => {
  test('resolves relative paths inside the workspace root', () => {
    const resolved = resolveWithinWorkspace({
      workspaceRoot: '/tmp/worktree',
      path: 'dev-research/mss-seed/seed/output.jsonld',
    })

    expect(resolved).toBe('/tmp/worktree/dev-research/mss-seed/seed/output.jsonld')
  })

  test('parses allowed roots relative to the workspace root', () => {
    const roots = parseAllowedRoots({
      workspaceRoot: '/tmp/worktree',
      value: 'dev-research/mss-seed\ndev-research/mss-corpus',
    })

    expect(roots).toEqual(['/tmp/worktree/dev-research/mss-seed', '/tmp/worktree/dev-research/mss-corpus'])
  })

  test('accepts paths inside an allowed root and blocks others', () => {
    const allowedRoots = ['/tmp/worktree/dev-research/mss-seed']

    expect(
      isAllowedWorkspacePath({
        path: '/tmp/worktree/dev-research/mss-seed/seed/mss.jsonld',
        allowedRoots,
      }),
    ).toBe(true)

    expect(
      isAllowedWorkspacePath({
        path: '/tmp/worktree/scripts/mss-seed.ts',
        allowedRoots,
      }),
    ).toBe(false)
  })
})
