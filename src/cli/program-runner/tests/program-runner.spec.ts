import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  buildProgramRunDir,
  findLatestProgramRunDir,
  getProgramLane,
  loadFactoryProgramRun,
  resolveProgramDefaults,
  runFactoryProgram,
  substituteProgramRunnerCommand,
} from '../program-runner.ts'
import { parseProgramScope } from '../program-scope.ts'

const tempDirs: string[] = []

const makeTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'plaited-program-runner-'))
  tempDirs.push(dir)
  return dir
}

const run = async (args: string[], cwd: string) => {
  const proc = Bun.spawn(args, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${args.join(' ')}\n${stdout}\n${stderr}`)
  }
}

const initRepo = async (root: string) => {
  await run(['git', 'init', '--initial-branch=main'], root)
  await run(['git', 'config', 'user.email', 'test@example.com'], root)
  await run(['git', 'config', 'user.name', 'Test User'], root)
  await Bun.write(join(root, 'README.md'), '# test\n')
  await run(['git', 'add', 'README.md'], root)
  await run(['git', 'commit', '-m', 'init'], root)
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (!dir) continue
    await Bun.$`rm -rf ${dir}`.quiet()
  }
})

describe('program-runner helpers', () => {
  test('derives lane and default allowed paths from program path', () => {
    expect(getProgramLane('dev-research/skill-factories/program.md')).toBe('skill-factories')

    expect(
      resolveProgramDefaults({
        programPath: 'dev-research/skill-factories/program.md',
        workspaceRoot: '/tmp/repo',
      }),
    ).toEqual({
      absoluteProgramPath: '/tmp/repo/dev-research/skill-factories/program.md',
      relativeProgramPath: 'dev-research/skill-factories/program.md',
      defaultAllowedPaths: ['dev-research/skill-factories/'],
    })
  })

  test('substitutes command placeholders', () => {
    expect(
      substituteProgramRunnerCommand({
        attempt: 2,
        artifactDir: '/tmp/run/attempt-02',
        command: ['echo', '{{attempt}}', '{{worktree}}', '{{program}}'],
        programPath: 'dev-research/skill-factories/program.md',
        runDir: '/tmp/run',
        worktreePath: '/tmp/run/attempt-02/worktree',
      }),
    ).toEqual(['echo', '2', '/tmp/run/attempt-02/worktree', 'dev-research/skill-factories/program.md'])
  })

  test('builds run directories under the default factory-program root', () => {
    const runDir = buildProgramRunDir({
      programPath: 'dev-research/skill-factories/program.md',
      workspaceRoot: '/tmp/repo',
    })

    expect(runDir.startsWith('/tmp/repo/.worktrees/factory-program-runner/skill-factories/')).toBe(true)
  })

  test('falls back to factory writable roots for factory lanes without explicit links', async () => {
    const scopedPaths = await parseProgramScope({
      programMarkdown: '# Default Factories\n\n## Goal\n\nTest lane.\n',
      programPath: '/tmp/repo/dev-research/default-factories/program.md',
      workspaceRoot: '/tmp/repo',
    })

    expect(scopedPaths).toEqual(['src/factories/', 'src/factories.ts'])
  })

  test('falls back to factory writable roots when scope section has no links', async () => {
    const scopedPaths = await parseProgramScope({
      programMarkdown: '# ACP Factories\n\n## Scope\n\nResearch only.\n',
      programPath: '/tmp/repo/dev-research/acp-factories/program.md',
      workspaceRoot: '/tmp/repo',
    })

    expect(scopedPaths).toEqual(['src/factories/', 'src/factories.ts'])
  })
})

describe('runFactoryProgram', () => {
  test('creates worktree-backed attempts and persists run status', async () => {
    const root = makeTempDir()
    await initRepo(root)

    const programPath = join(root, 'dev-research', 'skill-factories', 'program.md')
    await Bun.$`mkdir -p ${dirname(programPath)}`.quiet()
    await Bun.write(
      programPath,
      `# Skill Factories

## Goal

Test fanout.

## Writable Roots

- [bootstrap](../../src/bootstrap/bootstrap.ts)
- [eval](../../src/eval/)
`,
    )

    const cwd = process.cwd()
    process.chdir(root)
    try {
      const runInput = {
        programPath: 'dev-research/skill-factories/program.md',
        attempts: 2,
        parallel: 2,
        validateCommand: ['bun', '-e', "await Bun.write('validated.txt', 'ok')"],
      }
      const runResult = await runFactoryProgram(runInput)

      expect(runResult.attempts).toHaveLength(2)
      expect(runResult.attempts.every((attempt) => attempt.status === 'succeeded')).toBe(true)
      expect(runResult.allowedPaths).toEqual(['src/bootstrap/bootstrap.ts', 'src/eval/'])
      expect(await Bun.file(join(runResult.runDir, 'run.json')).exists()).toBe(true)
      expect(await Bun.file(join(runResult.attempts[0]!.artifactDir, 'status.json')).exists()).toBe(true)
      expect(await Bun.file(join(runResult.attempts[0]!.worktreePath, 'validated.txt')).exists()).toBe(true)

      const loaded = await loadFactoryProgramRun({
        programPath: 'dev-research/skill-factories/program.md',
        runDir: runResult.runDir,
      })

      expect(loaded.runDir).toBe(runResult.runDir)
      expect(loaded.attempts[0]?.status).toBe('succeeded')

      expect(
        await findLatestProgramRunDir({
          programPath: 'dev-research/skill-factories/program.md',
          workspaceRoot: root,
        }),
      ).toEndWith(`/skill-factories/${runResult.runDir.split('/').at(-1)}`)
    } finally {
      process.chdir(cwd)
    }
  })
})
