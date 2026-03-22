import { describe, expect, test } from 'bun:test'
import { suggestMinimumScale } from '../hypercard-scale-audit.ts'

describe('suggestMinimumScale', () => {
  test('raises multi-function business systems above flat S2', () => {
    const result = suggestMinimumScale({
      id: 'accounting',
      input:
        'Create a workflow module that this took two years or so to develop. it provides general ledger and payroll functions.',
      metadata: {
        promptSource: 'hypercard-archive',
        patternFamily: 'business-process',
      },
      _source: {
        title: 'Accounting',
        description: 'It provides general ledger and payroll functions.',
        mss: {
          scale: 2,
          structure: 'list',
          mechanics: [],
        },
      },
    })

    expect(result.suggestedScale).toBeGreaterThanOrEqual(4)
    expect(result.reasons).toContain('suite-language:2')
  })

  test('keeps simple list-like artifacts near S2', () => {
    const result = suggestMinimumScale({
      id: 'simple-list',
      input: 'Build a simple list of records I can browse privately.',
      metadata: {
        promptSource: 'hypercard-archive',
      },
      _source: {
        title: 'Simple List',
        description: 'A small private list of records.',
        mss: {
          scale: 2,
          structure: 'list',
          mechanics: [],
        },
      },
    })

    expect(result.suggestedScale).toBe(2)
  })

  test('raises thread/contact style artifacts to at least S3', () => {
    const result = suggestMinimumScale({
      id: 'contact-thread',
      input: 'Let people contact me and browse the conversation.',
      metadata: {
        promptSource: 'hypercard-archive',
      },
      _source: {
        title: 'Contact Thread',
        description: 'A discussion-like surface with contact mechanics.',
        mss: {
          scale: 2,
          structure: 'thread',
          mechanics: ['contact'],
        },
      },
    })

    expect(result.suggestedScale).toBeGreaterThanOrEqual(3)
    expect(result.reasons).toEqual(expect.arrayContaining(['structure-needs-block:thread', 'mechanics:contact']))
  })
})
