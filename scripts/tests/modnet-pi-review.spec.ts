import { describe, expect, test } from 'bun:test'
import { parseCliArgs, parseSourceInput, parseWinnerInput } from '../modnet-pi-review.ts'

describe('modnet pi review input parsing', () => {
  test('cli args default to the full prompt catalog', () => {
    expect(parseCliArgs(['bun', 'scripts/modnet-pi-review.ts'])).toEqual({
      bucket: null,
      catalogPath: 'dev-research/training-prompts/catalog/prompts.jsonl',
      bucketReviewPath: null,
      reviewDir: '.prompts/modnet-review',
    })
  })

  test('cli args support selecting a bucket queue', () => {
    expect(
      parseCliArgs(['bun', 'scripts/modnet-pi-review.ts', '--bucket', '05-education-reference-and-practice']),
    ).toEqual({
      bucket: '05-education-reference-and-practice',
      catalogPath: 'dev-research/training-prompts/catalog/buckets/05-education-reference-and-practice.jsonl',
      bucketReviewPath: 'dev-research/training-prompts/catalog/buckets/05-education-reference-and-practice.review.md',
      reviewDir: '.prompts/modnet-review/05-education-reference-and-practice',
    })
  })

  test('source menu numbers map to non-refine actions', () => {
    expect(parseSourceInput('1')).toBe('keep')
    expect(parseSourceInput('2')).toBe('remove')
    expect(parseSourceInput('4')).toBe('skip')
    expect(parseSourceInput('5')).toBe('quit')
  })

  test('source free text becomes refine feedback', () => {
    expect(parseSourceInput('make this more concrete')).toEqual({
      action: 'refine',
      feedback: 'make this more concrete',
    })
  })

  test('source unsupported numeric input is invalid', () => {
    expect(parseSourceInput('3')).toBeNull()
    expect(parseSourceInput('99')).toBeNull()
  })

  test('winner numbers map to winner actions', () => {
    expect(parseWinnerInput('1')).toBe('accept-winner')
    expect(parseWinnerInput('2')).toBe('reject-winner')
    expect(parseWinnerInput('4')).toBe('derive')
    expect(parseWinnerInput('5')).toBe('quit')
  })

  test('winner scale tokens map to adjust-scale', () => {
    expect(parseWinnerInput('s1')).toEqual({
      action: 'adjust-scale',
      target: 's1',
    })
    expect(parseWinnerInput('S5')).toEqual({
      action: 'adjust-scale',
      target: 's5',
    })
    expect(parseWinnerInput('rel')).toEqual({
      action: 'adjust-scale',
      target: 'rel',
    })
  })

  test('winner free text becomes refine feedback', () => {
    expect(parseWinnerInput('tighten the wording')).toEqual({
      action: 'refine',
      feedback: 'tighten the wording',
    })
  })

  test('winner unsupported numeric input is invalid', () => {
    expect(parseWinnerInput('3')).toBeNull()
    expect(parseWinnerInput('6')).toBeNull()
  })
})
