import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import {
  GIT_CONTEXT_TOOL_NAME,
  GIT_HISTORY_TOOL_NAME,
  GIT_STATUS_TOOL_NAME,
  GIT_WORKTREES_TOOL_NAME,
  gitContext,
  gitHistory,
  gitStatus,
  gitWorktrees,
} from '../git-context.ts'

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined
let tempRepo: string

const spawnGit = async (args: string[], cwd?: string) => {
  const proc = Bun.spawn(['git', ...args], { cwd: cwd ?? tempRepo, stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`)
  }
}

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  gitStatus(server)
  gitHistory(server)
  gitWorktrees(server)
  gitContext(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const createTempGitRepo = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), 'plaited-git-tool-'))
  await spawnGit(['init'], rootDir)
  await spawnGit(['config', 'user.email', 'test@example.com'], rootDir)
  await spawnGit(['config', 'user.name', 'Test'], rootDir)
  await spawnGit(['checkout', '-b', 'dev'], rootDir)
  await Bun.write(join(rootDir, 'README.md'), '# temp\n')
  await spawnGit(['add', '.'], rootDir)
  await spawnGit(['commit', '-m', 'chore: baseline'], rootDir)
  await spawnGit(['checkout', '-b', 'feature/test'], rootDir)
  await Bun.write(join(rootDir, 'src', 'tracked.ts'), 'export const x = 1\n')
  await spawnGit(['add', 'src/tracked.ts'], rootDir)
  await spawnGit(['commit', '-m', 'feat: add tracked file'], rootDir)
  return rootDir
}

type GitOutput = {
  ok: boolean
  mode: string
  repoRoot: string
  branch?: string | null
  head?: string
  dirty?: { isDirty: boolean; stagedCount: number; unstagedCount: number; untrackedCount: number }
  worktrees?: Array<{ isCurrent: boolean; exists: boolean; path: string }>
  warnings?: string[]
  isError?: boolean
  message?: string
}

describe('git tools', () => {
  beforeEach(async () => {
    await setupServer()
    tempRepo = await createTempGitRepo()
  })

  afterEach(async () => {
    await cleanupClosable?.()
    await rm(tempRepo, { recursive: true, force: true })
  })

  test('listTools includes all git tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain(GIT_STATUS_TOOL_NAME)
    expect(names).toContain(GIT_HISTORY_TOOL_NAME)
    expect(names).toContain(GIT_WORKTREES_TOOL_NAME)
    expect(names).toContain(GIT_CONTEXT_TOOL_NAME)
  })

  test('git_status returns clean status', async () => {
    const result = await client.callTool({
      name: GIT_STATUS_TOOL_NAME,
      arguments: { cwd: tempRepo },
    })
    const data = result.structuredContent as GitOutput
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('status')
    expect(data.dirty?.isDirty).toBe(false)
  })

  test('git_status reports staged, unstaged, and untracked files', async () => {
    await Bun.write(join(tempRepo, 'src', 'staged.ts'), 'export const staged = true\n')
    await spawnGit(['add', 'src/staged.ts'], tempRepo)
    await Bun.write(join(tempRepo, 'src', 'tracked.ts'), 'export const x = 2\n')
    await Bun.write(join(tempRepo, 'untracked.txt'), 'untracked\n')

    const result = await client.callTool({
      name: GIT_STATUS_TOOL_NAME,
      arguments: { cwd: tempRepo },
    })
    const data = result.structuredContent as GitOutput
    expect(data.ok).toBe(true)
    expect(data.dirty?.isDirty).toBe(true)
    expect(data.dirty?.stagedCount).toBe(1)
    expect(data.dirty?.unstagedCount).toBe(1)
    expect(data.dirty?.untrackedCount).toBe(1)
  })

  test('git_history returns commits since base', async () => {
    const result = await client.callTool({
      name: GIT_HISTORY_TOOL_NAME,
      arguments: { cwd: tempRepo, base: 'dev' },
    })
    const data = result.structuredContent as GitOutput
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('history')
    expect(data.repoRoot).toBeTruthy()
  })

  test('git_worktrees returns current worktree', async () => {
    const result = await client.callTool({
      name: GIT_WORKTREES_TOOL_NAME,
      arguments: { cwd: tempRepo },
    })
    const data = result.structuredContent as GitOutput
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('worktrees')
    expect(data.worktrees?.length).toBeGreaterThanOrEqual(1)
    expect(data.worktrees?.some((w) => w.isCurrent)).toBe(true)
    expect(data.worktrees?.every((w) => w.exists)).toBe(true)
  })

  test('git_context returns combined context without worktrees by default', async () => {
    const result = await client.callTool({
      name: GIT_CONTEXT_TOOL_NAME,
      arguments: { cwd: tempRepo, base: 'dev' },
    })
    const data = result.structuredContent as GitOutput
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('context')
  })

  test('git_context includes worktrees when requested', async () => {
    const result = await client.callTool({
      name: GIT_CONTEXT_TOOL_NAME,
      arguments: { cwd: tempRepo, base: 'dev', includeWorktrees: true },
    })
    const data = result.structuredContent as GitOutput
    expect(data.ok).toBe(true)
    expect(data.mode).toBe('context')
  })
})
