import { describe, expect, test } from 'bun:test'
import { buildBase1Prompt, extractJsonObject } from '../modnet-generate-raw-card-inclusion-candidates.ts'

describe('modnet-generate-raw-card-inclusion-candidates', () => {
  test('builds a Base 1 prompt that anchors on title and description only', () => {
    const prompt = buildBase1Prompt({
      id: 'hypercard_school-discipline',
      title: 'School Discipline',
      description: 'Track referrals for parent conferences and incident follow-up.',
    })

    expect(prompt).toContain('Use only the raw card title and description below.')
    expect(prompt).toContain('"id": "hypercard_school-discipline"')
    expect(prompt).toContain('Return JSON only.')
  })

  test('extracts direct JSON objects from plain output', () => {
    expect(
      extractJsonObject(
        JSON.stringify({
          inclusionDecision: 'retain',
          modernAnalog: 'A private school incident tracker.',
        }),
      ),
    ).toEqual({
      inclusionDecision: 'retain',
      modernAnalog: 'A private school incident tracker.',
    })
  })

  test('extracts fenced JSON objects from markdown output', () => {
    expect(
      extractJsonObject(`Here is the result:\n\n\`\`\`json\n{"inclusionDecision":"discard","modernAnalog":""}\n\`\`\``),
    ).toEqual({
      inclusionDecision: 'discard',
      modernAnalog: '',
    })
  })
})
