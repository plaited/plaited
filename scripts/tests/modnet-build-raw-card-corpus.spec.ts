import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT_PATH = new URL('../modnet-build-raw-card-corpus.ts', import.meta.url).pathname

describe('modnet-build-raw-card-corpus', () => {
  test('builds a minimal deduped raw-card corpus from hypercard and macrepo inputs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'modnet-raw-card-corpus-'))

    try {
      const hypercardPath = join(dir, 'hypercard.jsonl')
      const macrepoPath = join(dir, 'macrepo.jsonl')
      const outputPath = join(dir, 'out.jsonl')

      await Bun.write(
        hypercardPath,
        [
          JSON.stringify({
            id: 'hypercard_school-discipline',
            title: ' School Discipline ',
            description: ' Track referrals for parent conferences. ',
          }),
          JSON.stringify({
            id: 'duplicate-card',
            title: 'Duplicate',
            description: 'First description',
          }),
        ].join('\n'),
      )

      await Bun.write(
        macrepoPath,
        [
          JSON.stringify({
            id: 'duplicate-card',
            title: 'Duplicate',
            description: 'Second description should be dropped',
          }),
          JSON.stringify({
            id: 'macrepo_fax-router',
            title: ' Fax Router ',
            description: ' Route inbound fax-like documents for review. ',
          }),
        ].join('\n'),
      )

      const proc = Bun.spawn(
        [
          'bun',
          SCRIPT_PATH,
          '--hypercard-input',
          hypercardPath,
          '--macrepo-input',
          macrepoPath,
          '--output',
          outputPath,
        ],
        {
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )

      const exitCode = await proc.exited
      expect(exitCode).toBe(0)

      const stdout = await new Response(proc.stdout).text()
      const summary = JSON.parse(stdout) as {
        totalRows: number
        uniqueRows: number
      }

      expect(summary.totalRows).toBe(4)
      expect(summary.uniqueRows).toBe(3)

      const lines = (await Bun.file(outputPath).text())
        .trim()
        .split(/\n+/)
        .map((line) => JSON.parse(line) as { id: string; title: string; description: string })

      expect(lines).toEqual([
        {
          id: 'hypercard_school-discipline',
          title: 'School Discipline',
          description: 'Track referrals for parent conferences.',
        },
        {
          id: 'duplicate-card',
          title: 'Duplicate',
          description: 'First description',
        },
        {
          id: 'macrepo_fax-router',
          title: 'Fax Router',
          description: 'Route inbound fax-like documents for review.',
        },
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
