import { afterEach, describe, expect, test } from 'bun:test'
import { dirname, join } from 'node:path'
import { resolveImpactedTests, resolveImportPath, scanImports } from '../dev-autoresearch.ts'

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

    const resolved = await resolveImportPath(cwd, 'scripts/tests/runtime-harness.spec.ts', '../../src/runtime/create-link')

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
