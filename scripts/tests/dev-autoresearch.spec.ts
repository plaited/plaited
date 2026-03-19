import { afterEach, describe, expect, test } from 'bun:test'
import { dirname, join } from 'node:path'
import packageJson from '../../package.json' with { type: 'json' }
import {
  getChangedFiles,
  parseInput,
  parseSliceScope,
  resolveImpactedTests,
  resolveImportPath,
  scanImports,
} from '../dev-autoresearch.ts'

const tempDirs = new Set<string>()

const makeTempDir = async (): Promise<string> => {
  const dir = (await Bun.$`mktemp -d /tmp/plaited-dev-autoresearch-XXXXXX`.quiet()).text().trim()
  tempDirs.add(dir)
  return dir
}

const writeFixture = async (cwd: string, relativePath: string, contents: string) => {
  await Bun.$`mkdir -p ${dirname(join(cwd, relativePath))}`.quiet()
  await Bun.write(join(cwd, relativePath), contents)
}

afterEach(async () => {
  for (const dir of tempDirs) {
    await Bun.$`rm -rf ${dir}`.quiet()
  }
  tempDirs.clear()
})

describe('dev-autoresearch import resolution', () => {
  test('resolveImportPath prefers a real file candidate', async () => {
    const cwd = await makeTempDir()
    await writeFixture(cwd, 'src/runtime/create-link.ts', 'export const createLink = () => {}')

    const resolved = await resolveImportPath(
      cwd,
      'scripts/tests/runtime-harness.spec.ts',
      '../../src/runtime/create-link',
    )

    expect(resolved).toBe('src/runtime/create-link.ts')
  })

  test('scanImports resolves local imports to concrete files', async () => {
    const cwd = await makeTempDir()
    await writeFixture(cwd, 'src/runtime/create-link.ts', 'export const createLink = () => {}')
    await writeFixture(
      cwd,
      'scripts/tests/runtime-harness.spec.ts',
      "import { createLink } from '../../src/runtime/create-link'\nvoid createLink\n",
    )

    const imports = await scanImports(cwd, 'scripts/tests/runtime-harness.spec.ts')

    expect(imports).toEqual(['src/runtime/create-link.ts'])
  })

  test('resolveImpactedTests finds cross-directory tests through import scanning', async () => {
    const cwd = await makeTempDir()
    await writeFixture(cwd, 'src/runtime/create-link.ts', 'export const createLink = () => {}')
    await writeFixture(
      cwd,
      'scripts/tests/runtime-harness.spec.ts',
      "import { createLink } from '../../src/runtime/create-link'\nvoid createLink\n",
    )

    const impacted = await resolveImpactedTests(cwd, ['src/runtime/create-link.ts'])

    expect(impacted).toEqual(['scripts/tests/runtime-harness.spec.ts'])
  })
})

describe('dev-autoresearch slice parsing', () => {
  test('parses backtick-wrapped scope paths from real slice markdown', async () => {
    const slice = await Bun.file(join(import.meta.dir, '..', '..', 'dev-research/runtime-taxonomy/slice-1.md')).text()

    expect(parseSliceScope(slice)).toEqual(['src/runtime/'])
  })

  test('extracts inline code paths from prose scope lines', async () => {
    const slice = await Bun.file(join(import.meta.dir, '..', '..', 'dev-research/runtime-taxonomy/slice-3.md')).text()

    expect(parseSliceScope(slice)).toEqual(['src/runtime/', 'src/agent/', 'src/modnet/'])
  })
})

describe('dev-autoresearch git diff detection', () => {
  test('includes newly created untracked files in changed files', async () => {
    const cwd = await makeTempDir()
    await Bun.$`git init`.cwd(cwd).quiet()
    await Bun.$`git config user.email test@example.com`.cwd(cwd).quiet()
    await Bun.$`git config user.name "Test User"`.cwd(cwd).quiet()
    await writeFixture(cwd, 'tracked.ts', 'export const tracked = 1\n')
    await Bun.$`git add tracked.ts`.cwd(cwd).quiet()
    await Bun.$`git commit -m "init"`.cwd(cwd).quiet()

    await writeFixture(cwd, 'tracked.ts', 'export const tracked = 2\n')
    await writeFixture(cwd, 'new-file.ts', 'export const created = true\n')

    const changed = await getChangedFiles(cwd)

    expect(changed).toEqual(['new-file.ts', 'tracked.ts'])
  })
})

describe('dev-autoresearch dry run', () => {
  test('exits successfully without running an experiment', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        'scripts/dev-autoresearch.ts',
        './dev-research/runtime-taxonomy/slice-1.md',
        '--program',
        './dev-research/program.md',
        '--dry-run',
        '--max-attempts',
        '3',
      ],
      {
        cwd: join(import.meta.dir, '..', '..'),
        stdout: 'pipe',
        stderr: 'pipe',
        env: process.env as Record<string, string>,
      },
    )

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(stdout).toContain('dry-run=true attempts=3')
    expect(stdout).toContain('slice=./dev-research/runtime-taxonomy/slice-1.md')
    expect(stdout).toContain('allowedPaths=src/runtime/')
  })

  test('keeps positional slice parsing correct after boolean flags', () => {
    const parsed = parseInput([
      '--judge',
      './dev-research/runtime-taxonomy/slice-2.md',
      '--dry-run',
      '--no-push',
      '--quiet',
    ])

    expect(parsed.slicePath).toBe('./dev-research/runtime-taxonomy/slice-2.md')
    expect(parsed.push).toBe(false)
    expect(parsed.quiet).toBe(true)
  })

  test('package research script leaves slice selection to forwarded args', () => {
    expect(packageJson.scripts.research).toContain('varlock run -- bun --no-env-file scripts/dev-autoresearch.ts')
    expect(packageJson.scripts.research).not.toContain('slice-1.md')
    expect(packageJson.scripts.research).toContain('--push')

    const parsed = parseInput([
      './dev-research/runtime-taxonomy/slice-2.md',
      '--program',
      './dev-research/program.md',
      '--adapter',
      './scripts/codex-cli-adapter.ts',
      '--judge',
      '--commit',
      '--dry-run',
    ])

    expect(parsed.slicePath).toBe('./dev-research/runtime-taxonomy/slice-2.md')
    expect(parsed.programPath).toBe('./dev-research/program.md')
    expect(parsed.adapterPath).toBe('./scripts/codex-cli-adapter.ts')
    expect(parsed.judge).toBe(true)
    expect(parsed.commit).toBe(true)
    expect(parsed.push).toBe(true)
    expect(parsed.dryRun).toBe(true)
  })
})
