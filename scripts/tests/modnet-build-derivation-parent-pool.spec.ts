import { afterEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const tempDirs: string[] = []

const makeTempDir = async (): Promise<string> => {
  const dir = await Bun.$`mktemp -d /tmp/modnet-derivation-parent-pool-test.XXXXXX`.text()
  const trimmed = dir.trim()
  tempDirs.push(trimmed)
  return trimmed
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (!dir) continue
    await Bun.$`rm -rf ${dir}`.quiet()
  }
})

describe('modnet-build-derivation-parent-pool', () => {
  test('joins approved seed-review rows to regenerated candidates and handcrafted parents', async () => {
    const dir = await makeTempDir()
    const recommendedPath = join(dir, 'recommended.jsonl')
    const salvagePath = join(dir, 'salvage.jsonl')
    const trustedCandidatesPath = join(dir, 'trusted-candidates.jsonl')
    const iffyCandidatesPath = join(dir, 'iffy-candidates.jsonl')
    const handcraftedPath = join(dir, 'handcrafted.jsonl')
    const outputPath = join(dir, 'parents.jsonl')

    await Bun.write(
      recommendedPath,
      `${JSON.stringify({
        id: 'hypercard_parent',
        title: 'Parent',
        current: {
          patternFamily: 'reference-browser',
          mss: { structure: 'linked records', scale: 2, confidence: 'high' },
        },
        heuristicPrior: { suggestedMinimumScale: 4, scaleLooksUnderstated: true, reasons: ['suite-language'] },
        trusted: true,
        recommendedForSeedReview: true,
      })}\n`,
    )
    await Bun.write(salvagePath, '')
    await Bun.write(
      trustedCandidatesPath,
      `${JSON.stringify({
        rawCard: {
          id: 'hypercard_parent',
          title: 'Parent',
          description: 'Original source description.',
          coreUserJob: 'Maintain linked records.',
          whyRelevant: 'Durable linked-reference workflow.',
          likelyPatternFamily: 'reference-browser',
          likelyStructure: 'linked records',
        },
        promptDraft: {
          input: 'Build a local linked-records reference module.',
          hint: 'Local-first linked lookup.',
          metadata: {
            modernTitle: 'Linked Reference Module',
            likelyPatternFamily: 'reference-browser',
            structureCue: 'linked records with detail views',
            scale: 'S2',
            likelySubmodules: ['records', 'lookup'],
          },
        },
        research: {
          usedSearch: true,
          usedTargetedFollowUpSearch: true,
          usedLivecrawl: false,
        },
        assessment: {
          promptQuality: 'high',
        },
      })}\n`,
    )
    await Bun.write(iffyCandidatesPath, '')
    await Bun.write(
      handcraftedPath,
      `${JSON.stringify({
        id: 'farm-stand-s5-module',
        input: 'Build my complete farm stand module.',
        hint: 'Generate a Plaited-native produce module at S5.',
        metadata: {
          patternFamily: 'personal-data-manager',
          judge: { requiredConcepts: ['scale-S5'] },
        },
      })}\n`,
    )

    const result = Bun.spawnSync({
      cmd: [
        'bun',
        'scripts/modnet-build-derivation-parent-pool.ts',
        '--recommended',
        recommendedPath,
        '--salvage',
        salvagePath,
        '--trusted-candidates',
        trustedCandidatesPath,
        '--iffy-candidates',
        iffyCandidatesPath,
        '--handcrafted',
        handcraftedPath,
        '--output',
        outputPath,
      ],
      cwd: '/Users/eirby/Workspace/plaited',
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(result.exitCode).toBe(0)

    const rows = (await Bun.file(outputPath).text())
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>)

    expect(rows).toHaveLength(2)
    expect(rows[0]?.id).toBe('hypercard_parent')
    expect(rows[0]?.metadata).toMatchObject({
      promptSource: 'approved-regenerated-seed',
      generatedModernTitle: 'Linked Reference Module',
      generatedScale: 'S2',
      seedReviewCurrentScale: 2,
    })
    expect(rows[1]?.id).toBe('farm-stand-s5-module')
    expect(rows[1]?.metadata).toMatchObject({
      promptSource: 'handcrafted-parent',
      handcraftedParentEligible: true,
    })
  })

  test('derive-modnet-prompts respects min-source-scale override', async () => {
    const dir = await makeTempDir()
    const inputPath = join(dir, 'parents.jsonl')
    const outputPath = join(dir, 'derived.json')

    await Bun.write(
      inputPath,
      `${JSON.stringify({
        id: 'seed-s2',
        input: 'Build a local linked-records reference module with lookup and notes.',
        hint: 'Derived approved seed.',
        metadata: {
          patternFamily: 'reference-browser',
          generatedModernTitle: 'Linked Reference Module',
          generatedPromptInput: 'Build a local linked-records reference module with lookup and notes.',
          generatedPromptHint: 'Derived approved seed.',
          generatedScale: 'S2',
          generatedScaleValue: 2,
          sourceScaleEstimate: 4,
          sourceScaleEstimateLabel: 'S4',
        },
        _source: {
          title: 'Parent',
          description: 'Original source description',
          coreUserJob: 'Maintain linked records',
          whyRelevant: 'Durable linked-reference workflow',
          mss: {
            structure: 'linked records',
            scale: 2,
          },
        },
        title: 'Linked Reference Module',
        description: 'Original source description',
        coreUserJob: 'Maintain linked records',
        whyRelevant: 'Durable linked-reference workflow',
        likelyPatternFamily: 'reference-browser',
        likelyStructure: 'linked records',
      })}\n`,
    )

    const result = Bun.spawnSync({
      cmd: [
        'bun',
        'scripts/derive-modnet-prompts.ts',
        '--input',
        inputPath,
        '--output',
        outputPath,
        '--limit',
        '10',
        '--min-source-scale',
        '2',
      ],
      cwd: '/Users/eirby/Workspace/plaited',
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(result.exitCode).toBe(0)
    const payload = await Bun.file(outputPath).json()
    expect(payload).toMatchObject({
      inputPath,
      minSourceScale: 2,
      seedCount: 1,
    })
    expect(Array.isArray(payload.prompts)).toBe(true)
    expect(payload.prompts.length).toBeGreaterThan(0)
    expect(new Set(payload.prompts.map((prompt: { targetScale: string }) => prompt.targetScale))).toEqual(
      new Set(['S1']),
    )
  })
})
