import { describe, expect, test } from 'bun:test'
import {
  buildSandboxPolicy,
  getBashCommandViolations,
  isAllowedWorkspacePath,
  parseAllowedRoots,
  resolveWithinWorkspace,
} from '../pi-worktree-guard-extension.ts'

describe('pi-worktree-guard-extension', () => {
  test('resolves relative paths inside the workspace root', () => {
    const resolved = resolveWithinWorkspace({
      workspaceRoot: '/tmp/worktree',
      path: 'dev-research/behavioral-factories/policies/output.ts',
    })

    expect(resolved).toBe('/tmp/worktree/dev-research/behavioral-factories/policies/output.ts')
  })

  test('parses allowed roots relative to the workspace root', () => {
    const roots = parseAllowedRoots({
      workspaceRoot: '/tmp/worktree',
      value: 'dev-research/behavioral-factories\ndev-research/behavioral-factories/cache',
    })

    expect(roots).toEqual([
      '/tmp/worktree/dev-research/behavioral-factories',
      '/tmp/worktree/dev-research/behavioral-factories/cache',
    ])
  })

  test('accepts paths inside an allowed root and blocks others', () => {
    const allowedRoots = ['/tmp/worktree/dev-research/behavioral-factories']

    expect(
      isAllowedWorkspacePath({
        path: '/tmp/worktree/dev-research/behavioral-factories/policies/search.ts',
        allowedRoots,
      }),
    ).toBe(true)

    expect(
      isAllowedWorkspacePath({
        path: '/tmp/worktree/scripts/behavioral-factories.ts',
        allowedRoots,
      }),
    ).toBe(false)
  })

  test('blocks nested autoresearch and worktree bash commands', () => {
    const violations = getBashCommandViolations({
      command: 'git worktree add /tmp/attempt HEAD && bun run research:behavioral-factories',
      policy: {
        enabled: true,
        workspaceRoot: '/tmp/worktree',
        repoRoot: '/Users/eirby/Workspace/plaited',
        allowedRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
        readRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
      },
    })

    expect(violations).toContain('nested autoresearch/worktree operations are blocked')
  })

  test('blocks bash commands that target the canonical repo root', () => {
    const violations = getBashCommandViolations({
      command: 'echo hi > /Users/eirby/Workspace/plaited/dev-research/behavioral-factories/cache/plan.json',
      policy: {
        enabled: true,
        workspaceRoot: '/tmp/worktree',
        repoRoot: '/Users/eirby/Workspace/plaited',
        allowedRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
        readRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
      },
    })

    expect(violations).toContain('commands must use the active worktree, not the canonical repo root')
  })

  test('builds sandbox policy from environment', () => {
    const originalWorkspace = process.env.PLAITED_WORKSPACE_ROOT
    const originalRepoRoot = process.env.PLAITED_REPO_ROOT
    const originalWritableRoots = process.env.PLAITED_ALLOWED_WRITABLE_ROOTS
    const originalReadRoots = process.env.PLAITED_ALLOWED_READ_ROOTS
    const originalDisabled = process.env.PLAITED_SANDBOX_DISABLED

    process.env.PLAITED_WORKSPACE_ROOT = '/tmp/worktree'
    process.env.PLAITED_REPO_ROOT = '/Users/eirby/Workspace/plaited'
    process.env.PLAITED_ALLOWED_WRITABLE_ROOTS =
      'dev-research/behavioral-factories\ndev-research/behavioral-factories/cache'
    process.env.PLAITED_ALLOWED_READ_ROOTS =
      'dev-research/behavioral-factories\ndev-research/mss-seed/seed\ndev-research/behavioral-seed/seed'
    delete process.env.PLAITED_SANDBOX_DISABLED

    try {
      const policy = buildSandboxPolicy()

      expect(policy.enabled).toBe(true)
      expect(policy.workspaceRoot).toBe('/tmp/worktree')
      expect(policy.repoRoot).toBe('/Users/eirby/Workspace/plaited')
      expect(policy.allowedRoots).toEqual([
        '/tmp/worktree/dev-research/behavioral-factories',
        '/tmp/worktree/dev-research/behavioral-factories/cache',
      ])
      expect(policy.readRoots).toEqual([
        '/tmp/worktree/dev-research/behavioral-factories',
        '/tmp/worktree/dev-research/mss-seed/seed',
        '/tmp/worktree/dev-research/behavioral-seed/seed',
      ])
    } finally {
      if (originalWorkspace === undefined) delete process.env.PLAITED_WORKSPACE_ROOT
      else process.env.PLAITED_WORKSPACE_ROOT = originalWorkspace
      if (originalRepoRoot === undefined) delete process.env.PLAITED_REPO_ROOT
      else process.env.PLAITED_REPO_ROOT = originalRepoRoot
      if (originalWritableRoots === undefined) delete process.env.PLAITED_ALLOWED_WRITABLE_ROOTS
      else process.env.PLAITED_ALLOWED_WRITABLE_ROOTS = originalWritableRoots
      if (originalReadRoots === undefined) delete process.env.PLAITED_ALLOWED_READ_ROOTS
      else process.env.PLAITED_ALLOWED_READ_ROOTS = originalReadRoots
      if (originalDisabled === undefined) delete process.env.PLAITED_SANDBOX_DISABLED
      else process.env.PLAITED_SANDBOX_DISABLED = originalDisabled
    }
  })

  test('allows ordinary in-worktree bash commands', () => {
    const violations = getBashCommandViolations({
      command: 'mkdir -p dev-research/behavioral-factories/cache && echo ok',
      policy: {
        enabled: true,
        workspaceRoot: '/tmp/worktree',
        repoRoot: '/Users/eirby/Workspace/plaited',
        allowedRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
        readRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
      },
    })

    expect(violations).toEqual([])
  })

  test('does not block bash commands when sandbox is disabled', () => {
    const violations = getBashCommandViolations({
      command: 'git worktree add /tmp/attempt HEAD',
      policy: {
        enabled: false,
        workspaceRoot: '/tmp/worktree',
        repoRoot: '/Users/eirby/Workspace/plaited',
        allowedRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
        readRoots: ['/tmp/worktree/dev-research/behavioral-factories'],
      },
    })

    expect(violations).toEqual([])
  })
})
