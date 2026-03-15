/**
 * Tests for bThread factory validation (validate-thread).
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { validateThreadFactory } from '../validate-thread.ts'

// ============================================================================
// Fixtures — temporary factory files for each check
// ============================================================================

const FIXTURES_DIR = join(import.meta.dir, 'fixtures/validate-thread')

beforeAll(async () => {
  // Create fixture directory structure
  await Bun.write(
    join(FIXTURES_DIR, 'goals/valid-goal.ts'),
    `import { bThread, bSync } from '../../behavioral/behavioral.ts'
export const validGoal = {
  $: '🎯',
  create: (bThreads: { set: (t: Record<string, unknown>) => void }) => {
    bThreads.set({
      myGoal: bThread([
        bSync({ waitFor: 'some_event' }),
      ]),
    })
  },
}
`,
  )

  // Companion test for valid-goal
  await Bun.write(
    join(FIXTURES_DIR, 'goals/valid-goal.spec.ts'),
    `import { test, expect } from 'bun:test'
test('valid-goal fixture passes', () => { expect(true).toBe(true) })
`,
  )

  // Invalid: parse error
  await Bun.write(join(FIXTURES_DIR, 'goals/parse-error.ts'), `export const broken = {{{`)
  await Bun.write(
    join(FIXTURES_DIR, 'goals/parse-error.spec.ts'),
    `import { test, expect } from 'bun:test'
test('parse-error fixture', () => { expect(true).toBe(true) })
`,
  )

  // Invalid: wrong brand for directory
  await Bun.write(
    join(FIXTURES_DIR, 'goals/wrong-brand.ts'),
    `import { bThread, bSync } from '../../behavioral/behavioral.ts'
export const wrongBrand = {
  $: '🏛️',
  create: () => {},
}
`,
  )
  await Bun.write(
    join(FIXTURES_DIR, 'goals/wrong-brand.spec.ts'),
    `import { test, expect } from 'bun:test'
test('wrong-brand fixture', () => { expect(true).toBe(true) })
`,
  )

  // Invalid: disallowed import
  await Bun.write(
    join(FIXTURES_DIR, 'goals/bad-import.ts'),
    `import { something } from '../../tools/crud.ts'
export const badImport = {
  $: '🎯',
  create: () => {},
}
`,
  )
  await Bun.write(
    join(FIXTURES_DIR, 'goals/bad-import.spec.ts'),
    `import { test, expect } from 'bun:test'
test('bad-import fixture', () => { expect(true).toBe(true) })
`,
  )

  // Invalid: impure (uses fetch)
  await Bun.write(
    join(FIXTURES_DIR, 'goals/impure.ts'),
    `import { bThread, bSync } from '../../behavioral/behavioral.ts'
export const impure = {
  $: '🎯',
  create: () => {
    fetch('http://example.com')
  },
}
`,
  )
  await Bun.write(
    join(FIXTURES_DIR, 'goals/impure.spec.ts'),
    `import { test, expect } from 'bun:test'
test('impure fixture', () => { expect(true).toBe(true) })
`,
  )

  // Warning: shadows well-known thread name
  await Bun.write(
    join(FIXTURES_DIR, 'goals/shadow.ts'),
    `import { bThread, bSync } from '../../behavioral/behavioral.ts'
export const shadow = {
  $: '🎯',
  create: (bThreads: { set: (t: Record<string, unknown>) => void }) => {
    bThreads.set({
      taskGate: bThread([
        bSync({ waitFor: 'event' }),
      ]),
    })
  },
}
`,
  )
  await Bun.write(
    join(FIXTURES_DIR, 'goals/shadow.spec.ts'),
    `import { test, expect } from 'bun:test'
test('shadow fixture', () => { expect(true).toBe(true) })
`,
  )

  // Missing companion test
  await Bun.write(
    join(FIXTURES_DIR, 'goals/no-test.ts'),
    `import { bThread, bSync } from '../../behavioral/behavioral.ts'
export const noTest = {
  $: '🎯',
  create: () => {},
}
`,
  )
})

afterAll(async () => {
  // Clean up fixture directory
  const { rmSync } = await import('node:fs')
  rmSync(FIXTURES_DIR, { recursive: true, force: true })
})

// ============================================================================
// Tests
// ============================================================================

describe('validateThreadFactory', () => {
  test('valid factory passes all checks', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/valid-goal.ts'))
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
    expect(result.factory).toBeDefined()
    expect(result.factory!.brand).toBe('🎯')
    expect(result.factory!.name).toBe('valid-goal')
    expect(result.factory!.threadNames).toContain('myGoal')
  })

  test('check 1: parse error detected', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/parse-error.ts'))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Parse error'))).toBe(true)
  })

  test('check 2: wrong brand for directory', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/wrong-brand.ts'))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Brand'))).toBe(true)
  })

  test('check 3: disallowed import', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/bad-import.ts'))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Disallowed import'))).toBe(true)
  })

  test('check 4: impure factory detected', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/impure.ts'))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Impure API'))).toBe(true)
  })

  test('check 5: shadow warning for well-known thread names', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/shadow.ts'))
    // Shadow is a warning, not an error — may still be valid if companion test passes
    expect(result.warnings.some((w) => w.includes('taskGate'))).toBe(true)
  })

  test('check 6: missing companion test', async () => {
    const result = await validateThreadFactory(join(FIXTURES_DIR, 'goals/no-test.ts'))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Missing companion test'))).toBe(true)
  })

  test('non-existent file → error', async () => {
    const result = await validateThreadFactory('/tmp/does-not-exist.ts')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('does not exist')
  })
})
