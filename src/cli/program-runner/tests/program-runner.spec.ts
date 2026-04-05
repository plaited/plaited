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
  await Bun.$`mkdir -p ${join(root, 'src')}`.quiet()
  await Bun.$`mkdir -p ${join(root, 'node_modules', '.bin')}`.quiet()
  await Bun.write(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'program-runner-fixture',
        private: true,
        scripts: {
          tsc: 'tsc',
        },
      },
      null,
      2,
    ),
  )
  await Bun.write(
    join(root, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noEmit: true,
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    ),
  )
  await Bun.write(join(root, 'node_modules', '.bin', 'biome'), '#!/bin/sh\nexit 0\n')
  await Bun.write(join(root, 'node_modules', '.bin', 'tsc'), '#!/bin/sh\nexit 0\n')
  await Bun.$`chmod +x ${join(root, 'node_modules', '.bin', 'biome')}`.quiet()
  await Bun.$`chmod +x ${join(root, 'node_modules', '.bin', 'tsc')}`.quiet()
  await Bun.write(join(root, 'src', 'index.ts'), 'export const fixture = true\n')
  await run(['git', 'add', 'README.md', 'package.json', 'tsconfig.json', 'src/index.ts'], root)
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
      expect(await Bun.file(join(runResult.attempts[0]!.artifactDir, 'typecheck.stdout.log')).exists()).toBe(true)
      expect(await Bun.file(join(runResult.attempts[0]!.artifactDir, 'targeted-tests.stdout.log')).exists()).toBe(true)
      expect(await Bun.file(join(runResult.attempts[0]!.artifactDir, 'changed-paths.json')).exists()).toBe(false)

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

  test('fails attempts when the worker edits outside writable roots', async () => {
    const root = makeTempDir()
    await initRepo(root)

    const programPath = join(root, 'dev-research', 'default-factories', 'program.md')
    await Bun.$`mkdir -p ${dirname(programPath)}`.quiet()
    await Bun.write(
      programPath,
      `# Default Factories

## Writable Roots

- [factories](../../src/factories/)
- [factories.ts](../../src/factories.ts)
`,
    )

    const cwd = process.cwd()
    process.chdir(root)
    try {
      const runResult = await runFactoryProgram({
        programPath: 'dev-research/default-factories/program.md',
        workerCommand: ['bun', '-e', "await Bun.write('src/bootstrap/bootstrap.ts', 'bad')"],
      })

      expect(runResult.attempts).toHaveLength(1)
      expect(runResult.attempts[0]?.status).toBe('failed')
      expect(runResult.attempts[0]?.outOfScopePaths).toEqual(['src/bootstrap/bootstrap.ts'])
      await expect(
        Bun.file(join(runResult.attempts[0]!.artifactDir, 'out-of-scope-paths.json')).json(),
      ).resolves.toEqual(['src/bootstrap/bootstrap.ts'])
      expect(await Bun.file(join(runResult.runDir, 'retry-guidance.md')).text()).toContain('src/bootstrap/bootstrap.ts')
    } finally {
      process.chdir(cwd)
    }
  })

  test('records in-scope worker edits before validation', async () => {
    const root = makeTempDir()
    await initRepo(root)

    const programPath = join(root, 'dev-research', 'default-factories', 'program.md')
    await Bun.$`mkdir -p ${dirname(programPath)}`.quiet()
    await Bun.$`mkdir -p ${join(root, 'src', 'factories')}`.quiet()
    await Bun.write(
      programPath,
      `# Default Factories

## Writable Roots

- [factories](../../src/factories/)
- [factories.ts](../../src/factories.ts)
`,
    )

    const cwd = process.cwd()
    process.chdir(root)
    try {
      const runResult = await runFactoryProgram({
        programPath: 'dev-research/default-factories/program.md',
        workerCommand: ['bun', '-e', "await Bun.write('src/factories/new-factory.ts', 'export const ok = true\\n')"],
      })

      expect(runResult.attempts[0]?.status).toBe('succeeded')
      expect(runResult.attempts[0]?.changedPaths).toEqual(['src/factories/new-factory.ts'])
      const diffSummary = await Bun.file(join(runResult.attempts[0]!.artifactDir, 'diff-summary.txt')).text()
      expect(diffSummary).toContain('Untracked files:')
      expect(diffSummary).toContain('src/factories/new-factory.ts')
    } finally {
      process.chdir(cwd)
    }
  })
})
