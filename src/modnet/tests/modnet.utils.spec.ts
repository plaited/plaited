import { describe, expect, test } from 'bun:test'
import { hashConstitution } from '../modnet.utils.ts'

describe('hashConstitution', () => {
  test('returns wyhash-prefixed hex string', () => {
    const result = hashConstitution('test constitution')
    expect(result).toMatch(/^wyhash:[0-9a-f]+$/)
  })

  test('produces deterministic output for same input', () => {
    const a = hashConstitution('identical source')
    const b = hashConstitution('identical source')
    expect(a).toBe(b)
  })

  test('produces different output for different input', () => {
    const a = hashConstitution('constitution A')
    const b = hashConstitution('constitution B')
    expect(a).not.toBe(b)
  })

  test('handles empty string', () => {
    const result = hashConstitution('')
    expect(result).toMatch(/^wyhash:[0-9a-f]+$/)
  })

  test('handles long input', () => {
    const longSource = 'rule '.repeat(10_000)
    const result = hashConstitution(longSource)
    expect(result).toMatch(/^wyhash:[0-9a-f]+$/)
  })
})
