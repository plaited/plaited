import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { identifyFunctionTemplates } from '../is-function-template.ts'

// Fixtures form a local package via their own `package.json`.
const testPackage = join(import.meta.dir, 'fixtures')

describe('identifyFunctionTemplates — local package', () => {
  test('finds all FunctionTemplate exports in a package', () => {
    const results = identifyFunctionTemplates(testPackage)
    const names = results.map((r) => r.name).sort()

    // Card is declared in card.ts and re-exported from re-exports.ts.
    expect(names).toEqual(['Banner', 'Box', 'Button', 'Card', 'Card', 'FragileTemplate', 'Heading', 'Heading'])
  })

  test('excludes non-function exports', () => {
    const results = identifyFunctionTemplates(testPackage)
    const names = results.map((r) => r.name)

    expect(names).not.toContain('notATemplate')
    expect(names).not.toContain('wrongArity')
    expect(names).not.toContain('returnsWrongShape')
    expect(names).not.toContain('someString')
    expect(names).not.toContain('someNumber')
  })

  test('traces re-exports to original declaration', () => {
    const results = identifyFunctionTemplates(testPackage)

    const card = results.filter((r) => r.name === 'Card')
    expect(card).toHaveLength(2)
    expect(card.map((r) => r.file)).toContain(join(testPackage, 'card.ts'))
    expect(card.map((r) => r.file)).toContain(join(testPackage, 're-exports.ts'))
  })
})

describe('identifyFunctionTemplates — invalid inputs', () => {
  test('returns empty array for non-string inputs', () => {
    // @ts-expect-error: testing runtime guard
    expect(identifyFunctionTemplates(42)).toEqual([])
    // @ts-expect-error: testing runtime guard
    expect(identifyFunctionTemplates(null)).toEqual([])
    // @ts-expect-error: testing runtime guard
    expect(identifyFunctionTemplates({})).toEqual([])
    // @ts-expect-error: testing runtime guard
    expect(identifyFunctionTemplates([])).toEqual([])
  })

  test('returns empty array for non-existent package', () => {
    expect(identifyFunctionTemplates('@nonexistent__please/never-a-package')).toEqual([])
  })

  test('returns empty array for directory without package.json', () => {
    expect(identifyFunctionTemplates('/tmp')).toEqual([])
  })
})
