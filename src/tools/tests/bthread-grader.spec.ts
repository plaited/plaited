/**
 * Tests for the bThread generation grader.
 *
 * @remarks
 * Covers: known-good factories, known-bad factories (parse errors, impure code,
 * wrong brand), spec test execution, grading dimensions, and trial integration.
 */

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { BThreadPromptMetadataSchema, createBThreadGrader, grade } from '../bthread-grader.ts'
import { runTrial } from '../trial.ts'
import { loadPrompts } from '../trial.utils.ts'

// ============================================================================
// Fixtures — known-good and known-bad bThread factories
// ============================================================================

const PROJECT_ROOT = resolve(import.meta.dir, '../../..')

/** Valid goal factory — counts tool_result events, blocks execute after N */
const validGoalFactory = `import { bThread, bSync } from '../../behavioral/behavioral.utils.ts'

export const maxIterations = {
  $: '🎯',
  create: (bThreads: { set: (t: Record<string, unknown>) => void }) => {
    bThreads.set({
      maxIter: bThread([
        ...Array.from({ length: 10 }, () =>
          bSync({ waitFor: 'tool_result', interrupt: ['message'] }),
        ),
        bSync({
          block: 'execute',
          request: { type: 'message', detail: { content: 'Max iterations reached' } },
          interrupt: ['message'],
        }),
      ]),
    })
  },
}
`

/** Valid constitution factory — blocks dangerous bash commands */
const validConstitutionFactory = `import { bThread, bSync } from '../../behavioral/behavioral.utils.ts'

export const noRmRf = {
  $: '🏛️',
  create: (bThreads: { set: (t: Record<string, unknown>) => void }) => {
    bThreads.set({
      noRmRf: bThread([
        bSync({
          block: (e: { type: string; detail?: { toolCall?: { name: string; arguments?: { command?: string } } } }) =>
            e.type === 'execute' &&
            e.detail?.toolCall?.name === 'bash' &&
            (e.detail?.toolCall?.arguments?.command ?? '').includes('rm -rf /'),
        }),
      ], true),
    })
  },
}
`

/** Parse error — invalid TypeScript syntax */
const parseErrorFactory = `export const broken = {{{
  this is not valid typescript
}`

/** Impure factory — uses fetch (violates purity check) */
const impureFactory = `import { bThread, bSync } from '../../behavioral/behavioral.utils.ts'

export const impure = {
  $: '🎯',
  create: () => {
    fetch('http://example.com')
  },
}
`

/** Wrong brand — constitution brand in goals directory */
const wrongBrandFactory = `import { bThread, bSync } from '../../behavioral/behavioral.utils.ts'

export const wrongBrand = {
  $: '🏛️',
  create: () => {},
}
`

/** Disallowed import — imports from tools/ instead of behavioral/ or agent/ */
const badImportFactory = `import { something } from '../../tools/crud.ts'

export const badImport = {
  $: '🎯',
  create: () => {},
}
`

/** Companion spec that always passes */
const passingSpec = `import { test, expect } from 'bun:test'
test('factory is valid', () => { expect(true).toBe(true) })
`

/** Companion spec that always fails */
const failingSpec = `import { test, expect } from 'bun:test'
test('factory fails', () => { expect(true).toBe(false) })
`

// ============================================================================
// createBThreadGrader — Core Grading
// ============================================================================

describe('createBThreadGrader', () => {
  // Use a grader that skips tsc for fast unit tests
  // (tsc adds ~2s per check and requires real import resolution)
  const fastGrader = createBThreadGrader({
    typeCheck: false,
    projectRoot: PROJECT_ROOT,
  })

  test('valid goal factory passes all checks', async () => {
    const result = await fastGrader({
      input: 'Generate a max iterations bThread',
      output: validGoalFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBeGreaterThan(0)
    expect(result.dimensions).toBeDefined()
    expect(result.dimensions!.outcome).toBe(1)
    expect(result.dimensions!.process).toBeGreaterThan(0)
    expect(result.outcome).toBeDefined()
    expect(result.outcome!.checks).toBeDefined()
  })

  test('valid constitution factory passes with correct brand dir', async () => {
    const result = await fastGrader({
      input: 'Generate a bash safety bThread',
      output: validConstitutionFactory,
      metadata: { brandDir: 'dac', spec: passingSpec },
    })

    expect(result.pass).toBe(true)
    expect(result.dimensions!.outcome).toBe(1)
  })

  test('parse error fails with zero outcome', async () => {
    const result = await fastGrader({
      input: 'Generate a bThread',
      output: parseErrorFactory,
      metadata: { brandDir: 'goals' },
    })

    expect(result.pass).toBe(false)
    expect(result.dimensions!.outcome).toBe(0)
    expect(result.reasoning).toContain('parse: FAIL')
    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean }>
    const parseCheck = checks.find((c) => c.name === 'parse')
    expect(parseCheck).toBeDefined()
    expect(parseCheck!.pass).toBe(false)
  })

  test('impure factory fails validation', async () => {
    const result = await fastGrader({
      input: 'Generate a bThread',
      output: impureFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('validate: FAIL')
    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean }>
    const validateCheck = checks.find((c) => c.name === 'validate')
    expect(validateCheck).toBeDefined()
    expect(validateCheck!.pass).toBe(false)
  })

  test('wrong brand in goals directory fails validation', async () => {
    const result = await fastGrader({
      input: 'Generate a bThread',
      output: wrongBrandFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.pass).toBe(false)
    expect(result.reasoning).toContain('validate: FAIL')
  })

  test('disallowed import fails validation', async () => {
    const result = await fastGrader({
      input: 'Generate a bThread',
      output: badImportFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.pass).toBe(false)
    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean; error?: string }>
    const validateCheck = checks.find((c) => c.name === 'validate')
    expect(validateCheck).toBeDefined()
    expect(validateCheck!.pass).toBe(false)
  })

  test('failing spec test fails grading', async () => {
    const result = await fastGrader({
      input: 'Generate a bThread',
      output: validGoalFactory,
      metadata: { brandDir: 'goals', spec: failingSpec },
    })

    expect(result.pass).toBe(false)
    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean }>
    const specCheck = checks.find((c) => c.name === 'specTest')
    expect(specCheck).toBeDefined()
    expect(specCheck!.pass).toBe(false)
  })

  test('no spec provided skips spec check', async () => {
    const result = await fastGrader({
      input: 'Generate a bThread',
      output: validGoalFactory,
      metadata: { brandDir: 'goals' },
    })

    // Should still pass (parse + validate only)
    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean }>
    const specCheck = checks.find((c) => c.name === 'specTest')
    expect(specCheck).toBeUndefined()
  })
})

// ============================================================================
// Grading Dimensions
// ============================================================================

describe('grading dimensions', () => {
  const grader = createBThreadGrader({
    typeCheck: false,
    projectRoot: PROJECT_ROOT,
  })

  test('all-pass produces outcome=1, process=1', async () => {
    const result = await grader({
      input: 'Generate a bThread',
      output: validGoalFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.dimensions).toBeDefined()
    expect(result.dimensions!.outcome).toBe(1)
    expect(result.dimensions!.process).toBe(1)
    expect(result.dimensions!.efficiency).toBe(1)
  })

  test('parse failure reduces process score', async () => {
    const result = await grader({
      input: 'Generate a bThread',
      output: parseErrorFactory,
      metadata: { brandDir: 'goals' },
    })

    expect(result.dimensions!.outcome).toBe(0)
    expect(result.dimensions!.process).toBe(0)
  })

  test('partial failure produces fractional scores', async () => {
    // Factory that parses but fails validation (impure)
    const result = await grader({
      input: 'Generate a bThread',
      output: impureFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.dimensions!.outcome).toBe(0)
    // parse passes (weight 2), validate fails (weight 1), spec passes (weight 1) → 3/4
    expect(result.dimensions!.process).toBeGreaterThan(0)
    expect(result.dimensions!.process).toBeLessThan(1)
  })
})

// ============================================================================
// Type Check (with tsc)
// ============================================================================

describe('type check via tsc', () => {
  const tscGrader = createBThreadGrader({
    typeCheck: true,
    validate: false, // Isolate tsc testing
    projectRoot: PROJECT_ROOT,
  })

  test('valid factory passes type check', async () => {
    const result = await tscGrader({
      input: 'Generate a bThread',
      output: validGoalFactory,
      metadata: { brandDir: 'goals' },
    })

    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean; error?: string }>
    const tscCheck = checks.find((c) => c.name === 'typeCheck')
    expect(tscCheck).toBeDefined()
    expect(tscCheck!.pass).toBe(true)
  })

  test('type error fails type check', async () => {
    const typeErrorFactory = `import { bThread, bSync } from '../../behavioral/behavioral.utils.ts'

const count: number = 'not a number'
export const broken = {
  $: '🎯',
  create: () => {
    const x: string = count
  },
}
`
    const result = await tscGrader({
      input: 'Generate a bThread',
      output: typeErrorFactory,
      metadata: { brandDir: 'goals' },
    })

    const checks = result.outcome!.checks as Array<{ name: string; pass: boolean; error?: string }>
    const tscCheck = checks.find((c) => c.name === 'typeCheck')
    expect(tscCheck).toBeDefined()
    expect(tscCheck!.pass).toBe(false)
  })
})

// ============================================================================
// Default Export (polyglot compatibility)
// ============================================================================

describe('grade (default export)', () => {
  test('grade function is a valid Grader', async () => {
    const result = await grade({
      input: 'Generate a bThread',
      output: validGoalFactory,
      metadata: { brandDir: 'goals', spec: passingSpec },
    })

    expect(result.pass).toBeDefined()
    expect(result.score).toBeDefined()
    expect(typeof result.pass).toBe('boolean')
    expect(typeof result.score).toBe('number')
  })
})

// ============================================================================
// BThreadPromptMetadataSchema
// ============================================================================

describe('BThreadPromptMetadataSchema', () => {
  test('defaults brandDir to goals', () => {
    const result = BThreadPromptMetadataSchema.parse({})
    expect(result.brandDir).toBe('goals')
  })

  test('accepts valid brandDir values', () => {
    expect(BThreadPromptMetadataSchema.parse({ brandDir: 'goals' }).brandDir).toBe('goals')
    expect(BThreadPromptMetadataSchema.parse({ brandDir: 'dac' }).brandDir).toBe('dac')
    expect(BThreadPromptMetadataSchema.parse({ brandDir: 'workflows' }).brandDir).toBe('workflows')
  })

  test('rejects invalid brandDir', () => {
    expect(() => BThreadPromptMetadataSchema.parse({ brandDir: 'invalid' })).toThrow()
  })

  test('accepts optional spec and category', () => {
    const result = BThreadPromptMetadataSchema.parse({
      spec: 'test code here',
      category: 'safety',
    })
    expect(result.spec).toBe('test code here')
    expect(result.category).toBe('safety')
  })
})

// ============================================================================
// Prompt Cases Loading
// ============================================================================

describe('bundled prompt cases', () => {
  const promptsPath = resolve(import.meta.dir, 'fixtures/bthread-prompts/prompts.jsonl')

  test('loads all prompt cases', async () => {
    const prompts = await loadPrompts(promptsPath)
    expect(prompts.length).toBeGreaterThanOrEqual(4)
    for (const prompt of prompts) {
      expect(prompt.id).toBeDefined()
      expect(prompt.input).toBeDefined()
    }
  })

  test('each prompt has valid metadata', async () => {
    const prompts = await loadPrompts(promptsPath)
    for (const prompt of prompts) {
      expect(prompt.metadata).toBeDefined()
      const meta = BThreadPromptMetadataSchema.safeParse(prompt.metadata)
      expect(meta.success).toBe(true)
    }
  })

  test('each prompt has spec content', async () => {
    const prompts = await loadPrompts(promptsPath)
    for (const prompt of prompts) {
      const meta = BThreadPromptMetadataSchema.parse(prompt.metadata)
      expect(meta.spec).toBeDefined()
      expect(meta.spec!.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================================
// Trial Integration
// ============================================================================

describe('trial integration', () => {
  test('grader works with runTrial', async () => {
    const echoAdapter = async (_input: { prompt: string | string[] }) => ({
      output: validGoalFactory,
    })

    const grader = createBThreadGrader({
      typeCheck: false,
      projectRoot: PROJECT_ROOT,
    })

    const results = await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'integration', input: 'Generate a bThread', metadata: { brandDir: 'goals', spec: passingSpec } }],
      grader,
      k: 2,
    })

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r).toBeDefined()
    expect(r!.passRate).toBe(1)
    expect(r!.passAtK).toBe(1)
    expect(r!.passExpK).toBe(1)
    expect(r!.trials).toHaveLength(2)
    for (const trial of r!.trials) {
      expect(trial.pass).toBe(true)
      expect(trial.score).toBe(1)
    }
  })

  test('grader reports partial pass rates with mixed output', async () => {
    let callCount = 0
    const mixedAdapter = async () => ({
      output: callCount++ % 2 === 0 ? validGoalFactory : parseErrorFactory,
    })

    const grader = createBThreadGrader({
      typeCheck: false,
      projectRoot: PROJECT_ROOT,
    })

    const results = await runTrial({
      adapter: mixedAdapter,
      prompts: [{ id: 'mixed', input: 'Generate a bThread', metadata: { brandDir: 'goals', spec: passingSpec } }],
      grader,
      k: 4,
    })

    const r = results[0]
    expect(r).toBeDefined()
    expect(r!.passRate).toBeDefined()
    expect(r!.passRate!).toBeGreaterThan(0)
    expect(r!.passRate!).toBeLessThan(1)
    expect(r!.passAtK).toBeDefined()
    expect(r!.passAtK!).toBeGreaterThan(0)
  })
})
