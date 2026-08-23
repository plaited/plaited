import { describe, expect, test } from 'bun:test'
import { SWAP_MODES, SWAP_TARGETS } from '../message.constants.ts'
import { swapBoundary } from '../swap-boundary.ts'

describe('swapBoundary — into modes return self', () => {
  test('afterbegin, beforeend, innerHTML are self boundaries', () => {
    expect(swapBoundary(SWAP_MODES.afterbegin)).toBe(SWAP_TARGETS.self)
    expect(swapBoundary(SWAP_MODES.beforeend)).toBe(SWAP_TARGETS.self)
    expect(swapBoundary(SWAP_MODES.innerHTML)).toBe(SWAP_TARGETS.self)
  })
})

describe('swapBoundary — replace/beside modes return parent', () => {
  test('beforebegin, afterend, outerHTML are parent boundaries', () => {
    expect(swapBoundary(SWAP_MODES.beforebegin)).toBe(SWAP_TARGETS.parent)
    expect(swapBoundary(SWAP_MODES.afterend)).toBe(SWAP_TARGETS.parent)
    expect(swapBoundary(SWAP_MODES.outerHTML)).toBe(SWAP_TARGETS.parent)
  })
})
