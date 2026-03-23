import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT_PATH = new URL('../modnet-build-retained-raw-card-corpus.ts', import.meta.url).pathname

describe('modnet-build-retained-raw-card-corpus', () => {
  test('builds a retained raw-card corpus from recommended non-discard evaluations', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'modnet-retained-raw-card-corpus-'))

    try {
      const inputPath = join(dir, 'evals.jsonl')
      const outputPath = join(dir, 'retained.jsonl')

      await Bun.write(
        inputPath,
        [
          JSON.stringify({
            candidate: {
              id: 'hypercard_school-discipline',
              title: 'School Discipline',
              description: 'Track referrals for parent conferences.',
              inclusionDecision: 'retain',
              modernAnalog: 'A private student discipline referral tracker.',
              coreUserJob: 'Track incidents and parent-facing referrals.',
              whyRelevant: 'The workflow remains current for school administration.',
              likelyPatternFamily: 'business-process',
              likelyStructure: 'form',
              searchQuerySeed: 'school discipline referral tracking software',
            },
            rawCard: {
              id: 'hypercard_school-discipline',
              title: 'School Discipline',
              description: 'Track referrals for parent conferences.',
            },
            recommended: true,
          }),
          JSON.stringify({
            candidate: {
              id: 'obsolete-demo',
              title: 'Obsolete Demo',
              description: 'Thin novelty demo.',
              inclusionDecision: 'discard',
              modernAnalog: 'None',
              coreUserJob: 'None',
              whyRelevant: 'No durable job.',
              likelyPatternFamily: 'unknown',
              likelyStructure: 'form',
              searchQuerySeed: '',
            },
            rawCard: {
              id: 'obsolete-demo',
              title: 'Obsolete Demo',
              description: 'Thin novelty demo.',
            },
            recommended: true,
          }),
        ].join('\n'),
      )

      const proc = Bun.spawn(['bun', SCRIPT_PATH, '--input', inputPath, '--output', outputPath], {
        stdout: 'pipe',
        stderr: 'pipe',
      })

      expect(await proc.exited).toBe(0)

      const stdout = await new Response(proc.stdout).text()
      const summary = JSON.parse(stdout) as { retainedRows: number; validationPlan: Array<{ stage: string }> }

      expect(summary.retainedRows).toBe(1)
      expect(summary.validationPlan).toHaveLength(4)

      const rows = (await Bun.file(outputPath).text())
        .trim()
        .split(/\n+/)
        .map((line) => JSON.parse(line) as Record<string, string>)

      expect(rows).toEqual([
        expect.objectContaining({
          id: 'hypercard_school-discipline',
          inclusionDecision: 'retain',
          likelyPatternFamily: 'business-process',
          likelyStructure: 'form',
        }),
      ])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
