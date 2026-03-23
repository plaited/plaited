import { describe, expect, test } from 'bun:test'
import {
  BASE_1_VALIDATION_PLAN,
  dedupeRawPromptCards,
  normalizeRawCardText,
  parseRawPromptCard,
} from '../modnet-raw-card-base.ts'

describe('modnet-raw-card-base', () => {
  test('parses and normalizes raw prompt cards', () => {
    const row = parseRawPromptCard(
      JSON.stringify({
        id: ' hypercard_school-discipline ',
        title: ' School Discipline ',
        description: ' Track referrals for parent conferences. ',
      }),
    )

    expect(row).toEqual({
      id: 'hypercard_school-discipline',
      title: 'School Discipline',
      description: 'Track referrals for parent conferences.',
    })
  })

  test('dedupes raw prompt cards by id while preserving first occurrence', () => {
    const rows = dedupeRawPromptCards([
      { id: 'same', title: 'First', description: 'First description' },
      { id: 'same', title: 'Second', description: 'Second description' },
      { id: 'other', title: 'Other', description: 'Other description' },
    ])

    expect(rows).toEqual([
      { id: 'same', title: 'First', description: 'First description' },
      { id: 'other', title: 'Other', description: 'Other description' },
    ])
  })

  test('exposes the four-stage Base 1 validation plan', () => {
    expect(BASE_1_VALIDATION_PLAN.map((entry) => entry.stage)).toEqual([
      'deterministic_prefilter',
      'codex_generation',
      'primary_judgment',
      'meta_verification',
    ])
    expect(normalizeRawCardText(' A  B\tC ')).toBe('A B C')
  })
})
