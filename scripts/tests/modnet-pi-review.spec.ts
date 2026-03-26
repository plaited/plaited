import { describe, expect, test } from 'bun:test'
import { parseSourceInput, parseWinnerInput } from '../modnet-pi-review.ts'

describe('modnet pi review input parsing', () => {
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
