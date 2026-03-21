import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { loadCandidates, parseArgs, prepareTrainingRun, shapeSftExample, toSftExample } from '../native-model-train.ts'

const tempDir = '/tmp/plaited-native-model-train-spec'

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('native-model-train', () => {
  test('parseArgs builds dataset and manifest paths', () => {
    const parsed = parseArgs([
      '--input',
      './input.jsonl',
      '--output-dir',
      './out',
      '--base-model',
      'model-x',
      '--max-example-tokens',
      '256',
    ])

    expect(parsed.inputPath).toBe('./input.jsonl')
    expect(parsed.outputDir).toBe('./out')
    expect(parsed.datasetPath).toBe('./out/sft-chat.jsonl')
    expect(parsed.manifestPath).toBe('./out/manifest.json')
    expect(parsed.baseModel).toBe('model-x')
    expect(parsed.maxExampleTokens).toBe(256)
  })

  test('toSftExample converts curated candidate into chat format', () => {
    const example = toSftExample({
      id: 'case-1',
      input: 'Prompt text',
      output: 'Answer text',
      trialNum: 2,
      assessment: {
        eligible: true,
        weight: 0.8,
        reasons: [],
      },
      metadata: {
        themeId: 'controller-compatible-ui-generation',
      },
    })

    expect(example).toEqual({
      messages: [
        { role: 'user', content: 'Prompt text' },
        { role: 'assistant', content: 'Answer text' },
      ],
      weight: 0.8,
      metadata: {
        themeId: 'controller-compatible-ui-generation',
        sourceCandidateId: 'case-1',
        trialNum: 2,
      },
    })
  })

  test('prepareTrainingRun writes SFT dataset and manifest', async () => {
    await mkdir(tempDir, { recursive: true })
    const inputPath = `${tempDir}/curated.jsonl`
    const outputDir = `${tempDir}/run`

    await Bun.write(
      inputPath,
      `${JSON.stringify({
        id: 'case-1',
        input: 'Prompt text',
        output: 'Answer text',
        trialNum: 1,
        assessment: { eligible: true, weight: 0.9, reasons: [] },
        metadata: { themeId: 'mss-grounded-module-generation' },
      })}\n`,
    )

    await mkdir(outputDir, { recursive: true })
    const prepared = await prepareTrainingRun({
      inputPath,
      outputDir,
      datasetPath: `${outputDir}/sft-chat.jsonl`,
      manifestPath: `${outputDir}/manifest.json`,
      baseModel: 'model-x',
      maxExampleTokens: 512,
      runTrainer: false,
    })

    expect(prepared.candidates).toHaveLength(1)
    expect(prepared.examples).toHaveLength(1)

    const dataset = await Bun.file(`${outputDir}/sft-chat.jsonl`).text()
    const manifest = await Bun.file(`${outputDir}/manifest.json`).json()

    expect(dataset).toContain('"messages"')
    expect(dataset).toContain('"weight":0.9')
    expect(manifest).toEqual(
      expect.objectContaining({
        inputPath,
        datasetPath: `${outputDir}/sft-chat.jsonl`,
        baseModel: 'model-x',
        candidateCount: 1,
        sourceExampleCount: 1,
        exampleCount: 1,
        maxExampleTokens: 512,
      }),
    )
  })

  test('shapeSftExample slices oversized sectioned outputs into bounded examples', () => {
    const shaped = shapeSftExample({
      example: {
        messages: [
          { role: 'user', content: 'Design the module.' },
          {
            role: 'assistant',
            content: ['## Overview', 'A'.repeat(900), '', '## Runtime Wiring', 'B'.repeat(900)].join('\n'),
          },
        ],
        weight: 1,
        metadata: { sourceCandidateId: 'case-1', trialNum: 1 },
      },
      maxExampleTokens: 300,
    })

    expect(shaped.length).toBeGreaterThan(1)
    expect(shaped[0]?.messages[0]?.content).toContain('Focus only on these sections')
    expect(shaped[0]?.metadata).toEqual(
      expect.objectContaining({
        shaping: expect.objectContaining({
          strategy: 'section_slice',
          totalSlices: shaped.length,
        }),
      }),
    )
  })

  test('loadCandidates rejects missing curated dataset', async () => {
    await expect(loadCandidates(`${tempDir}/missing.jsonl`)).rejects.toThrow('Curated dataset not found')
  })
})
