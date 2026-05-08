import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

describe('wiki skill CLI', () => {
  test('context mode ranks relevant docs from supplied paths', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'plaited-wiki-skill-context-'))

    try {
      await mkdir(join(rootDir, 'docs'), { recursive: true })
      await Bun.write(
        join(rootDir, 'docs', 'runtime-boundary.md'),
        '# Runtime Boundary\n\nWorker runtime boundary notes.\n',
      )
      await Bun.write(join(rootDir, 'docs', 'changelog.md'), '# Changelog\n\nRelease notes.\n')

      const result = await Bun.$`bun skills/wiki/scripts/wiki.ts ${JSON.stringify({
        mode: 'context',
        rootDir,
        paths: ['docs'],
        task: 'review runtime boundary',
      })}`
        .cwd(CLI_PACKAGE_ROOT)
        .quiet()
        .nothrow()

      expect(result.exitCode).toBe(0)
      const output = JSON.parse(result.stdout.toString().trim()) as {
        pages: Array<{ path: string }>
      }

      expect(output.pages[0]?.path).toBe('docs/runtime-boundary.md')
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
