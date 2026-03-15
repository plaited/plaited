import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { checkMacProtection, MAC_PROTECTED_EVENTS, loadPersistedGoals, saveGoal, removeGoal } from '../agent.goals.ts'

// ============================================================================
// MAC Protection Check
// ============================================================================

describe('checkMacProtection', () => {
  test('passes for source with no block declarations', () => {
    const source = `
      export const myGoal = {
        $: '🎯',
        create: () => ({
          threads: {
            goal_watch: bThread([
              bSync({ waitFor: 'sensor_delta' }),
            ], true),
          },
        }),
      }
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('passes for source blocking non-MAC events', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'execute' && e.detail?.command?.includes('rm -rf'),
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('fails for source blocking invoke_inference', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'invoke_inference',
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('invoke_inference')
  })

  test('fails for source blocking model_response', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'model_response',
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('model_response'))).toBe(true)
  })

  test('fails for source blocking gate_approved', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'gate_approved',
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('gate_approved'))).toBe(true)
  })

  test('fails for source blocking task', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'task',
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('task'))).toBe(true)
  })

  test('fails for source blocking message', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'message',
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('message'))).toBe(true)
  })

  test('reports all MAC violations', () => {
    const source = `
      bSync({
        block: (e) => e.type === 'invoke_inference' || e.type === 'model_response',
      })
    `
    const result = checkMacProtection(source)
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  test('all MAC_PROTECTED_EVENTS are checked', () => {
    expect(MAC_PROTECTED_EVENTS.size).toBe(7)
    expect(MAC_PROTECTED_EVENTS.has('invoke_inference')).toBe(true)
    expect(MAC_PROTECTED_EVENTS.has('model_response')).toBe(true)
    expect(MAC_PROTECTED_EVENTS.has('gate_approved')).toBe(true)
    expect(MAC_PROTECTED_EVENTS.has('gate_rejected')).toBe(true)
    expect(MAC_PROTECTED_EVENTS.has('task')).toBe(true)
    expect(MAC_PROTECTED_EVENTS.has('message')).toBe(true)
    expect(MAC_PROTECTED_EVENTS.has('loop_complete')).toBe(true)
  })
})

// ============================================================================
// Goal Persistence — Integration Tests
// ============================================================================

describe('goal persistence', () => {
  let tmpDir: string
  let goalsDir: string

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'plaited-goals-test-'))
    goalsDir = join(tmpDir, 'goals')
    await Bun.write(join(goalsDir, '.gitkeep'), '')
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  // Valid goal factory source — no imports needed, self-contained
  const validGoalSource = `
export const testGoal = {
  $: '🎯' as const,
  create: () => ({
    threads: {},
  }),
}
`

  const validGoalSpec = `
import { test, expect } from 'bun:test'
import { testGoal } from './test-goal.ts'

test('test-goal has correct brand', () => {
  expect(testGoal.$).toBe('🎯')
})
`

  describe('saveGoal', () => {
    test('saves valid goal factory', async () => {
      // Write companion spec first (test-first pattern)
      await Bun.write(join(goalsDir, 'test-goal.spec.ts'), validGoalSpec)

      const result = await saveGoal(goalsDir, 'test-goal', validGoalSource)
      expect(result.path).toBe(join(goalsDir, 'test-goal.ts'))
      expect(result.validation).toBeDefined()
      expect(result.macErrors).toHaveLength(0)

      // Verify file was written
      expect(await Bun.file(join(goalsDir, 'test-goal.ts')).exists()).toBe(true)
    })

    test('rejects goal factory that blocks MAC events', async () => {
      const macViolatingSource = `
export const badGoal = {
  $: '🎯' as const,
  create: () => ({
    threads: {},
  }),
}
// block: (e) => e.type === 'invoke_inference'
`
      // Write companion spec
      await Bun.write(
        join(goalsDir, 'bad-goal.spec.ts'),
        `
import { test, expect } from 'bun:test'
import { badGoal } from './bad-goal.ts'
test('bad-goal has correct brand', () => {
  expect(badGoal.$).toBe('🎯')
})
`,
      )

      const result = await saveGoal(goalsDir, 'bad-goal', macViolatingSource)
      expect(result.success).toBe(false)
      expect(result.macErrors.length).toBeGreaterThan(0)

      // Verify file was cleaned up
      expect(await Bun.file(join(goalsDir, 'bad-goal.ts')).exists()).toBe(false)
    })
  })

  describe('removeGoal', () => {
    test('removes existing goal factory', async () => {
      // Create a goal file to remove
      await Bun.write(join(goalsDir, 'removable.ts'), validGoalSource)
      await Bun.write(join(goalsDir, 'removable.spec.ts'), 'test("pass", () => {})')

      const removed = await removeGoal(goalsDir, 'removable')
      expect(removed).toBe(true)

      // Both factory and spec should be removed
      expect(await Bun.file(join(goalsDir, 'removable.ts')).exists()).toBe(false)
      expect(await Bun.file(join(goalsDir, 'removable.spec.ts')).exists()).toBe(false)
    })

    test('returns false for non-existent goal', async () => {
      const removed = await removeGoal(goalsDir, 'does-not-exist')
      expect(removed).toBe(false)
    })
  })

  describe('loadPersistedGoals', () => {
    test('returns empty array for non-existent directory', async () => {
      const result = await loadPersistedGoals(join(tmpDir, 'nonexistent'))
      expect(result).toEqual([])
    })

    test('returns empty array for directory with no valid goals', async () => {
      const emptyGoalsDir = join(tmpDir, 'empty-goals')
      await Bun.write(join(emptyGoalsDir, '.gitkeep'), '')
      const result = await loadPersistedGoals(emptyGoalsDir)
      expect(result).toEqual([])
    })
  })
})
