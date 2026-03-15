import { describe, expect, test } from 'bun:test'
import {
  type ConstitutionFactory,
  createConstitution,
  createGoal,
  createWorkflow,
  FACTORY_BRANDS,
  type GoalFactory,
  isBrandedFactory,
  isConstitutionFactory,
  isGoalFactory,
  isWorkflowFactory,
  type WorkflowFactory,
} from '../agent.factories.ts'

// ============================================================================
// Factory Branding
// ============================================================================

describe('createConstitution', () => {
  const factory = createConstitution(() => ({ threads: {} }))

  test('brands with 🏛️', () => {
    expect(factory.$).toBe('🏛️')
  })

  test('preserves create function', () => {
    expect(typeof factory.create).toBe('function')
  })

  test('create returns FactoryResult', () => {
    const noop = () => {}
    const result = factory.create(noop as never)
    expect(result).toHaveProperty('threads')
  })

  test('satisfies ConstitutionFactory type', () => {
    const _typed: ConstitutionFactory = factory
    expect(_typed.$).toBe(FACTORY_BRANDS.constitution)
  })
})

describe('createGoal', () => {
  const factory = createGoal(() => ({ handlers: {} }))

  test('brands with 🎯', () => {
    expect(factory.$).toBe('🎯')
  })

  test('preserves create function', () => {
    expect(typeof factory.create).toBe('function')
  })

  test('create returns FactoryResult with handlers', () => {
    const noop = () => {}
    const result = factory.create(noop as never)
    expect(result).toHaveProperty('handlers')
  })

  test('satisfies GoalFactory type', () => {
    const _typed: GoalFactory = factory
    expect(_typed.$).toBe(FACTORY_BRANDS.goal)
  })
})

describe('createWorkflow', () => {
  const factory = createWorkflow(() => ({}))

  test('brands with 🔄', () => {
    expect(factory.$).toBe('🔄')
  })

  test('preserves create function', () => {
    expect(typeof factory.create).toBe('function')
  })

  test('create returns empty FactoryResult', () => {
    const noop = () => {}
    const result = factory.create(noop as never)
    expect(result).toEqual({})
  })

  test('satisfies WorkflowFactory type', () => {
    const _typed: WorkflowFactory = factory
    expect(_typed.$).toBe(FACTORY_BRANDS.workflow)
  })
})

// ============================================================================
// FACTORY_BRANDS constants
// ============================================================================

describe('FACTORY_BRANDS', () => {
  test('has correct constitution brand', () => {
    expect(FACTORY_BRANDS.constitution).toBe('🏛️')
  })

  test('has correct goal brand', () => {
    expect(FACTORY_BRANDS.goal).toBe('🎯')
  })

  test('has correct workflow brand', () => {
    expect(FACTORY_BRANDS.workflow).toBe('🔄')
  })
})

// ============================================================================
// Type Guards
// ============================================================================

describe('isBrandedFactory', () => {
  test('returns true for constitution factory', () => {
    const factory = createConstitution(() => ({}))
    expect(isBrandedFactory(factory)).toBe(true)
  })

  test('returns true for goal factory', () => {
    const factory = createGoal(() => ({}))
    expect(isBrandedFactory(factory)).toBe(true)
  })

  test('returns true for workflow factory', () => {
    const factory = createWorkflow(() => ({}))
    expect(isBrandedFactory(factory)).toBe(true)
  })

  test('returns false for null', () => {
    expect(isBrandedFactory(null)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isBrandedFactory(undefined)).toBe(false)
  })

  test('returns false for string', () => {
    expect(isBrandedFactory('not a factory')).toBe(false)
  })

  test('returns false for object without $ brand', () => {
    expect(isBrandedFactory({ create: () => ({}) })).toBe(false)
  })

  test('returns false for object with unknown brand', () => {
    expect(isBrandedFactory({ $: '❌', create: () => ({}) })).toBe(false)
  })

  test('returns false for object with brand but no create', () => {
    expect(isBrandedFactory({ $: '🎯' })).toBe(false)
  })

  test('returns false for object with brand but create is not function', () => {
    expect(isBrandedFactory({ $: '🎯', create: 'not a function' })).toBe(false)
  })
})

describe('isGoalFactory', () => {
  test('returns true for goal factory', () => {
    expect(isGoalFactory(createGoal(() => ({})))).toBe(true)
  })

  test('returns false for constitution factory', () => {
    expect(isGoalFactory(createConstitution(() => ({})))).toBe(false)
  })

  test('returns false for workflow factory', () => {
    expect(isGoalFactory(createWorkflow(() => ({})))).toBe(false)
  })

  test('returns false for non-factory', () => {
    expect(isGoalFactory(42)).toBe(false)
  })
})

describe('isConstitutionFactory', () => {
  test('returns true for constitution factory', () => {
    expect(isConstitutionFactory(createConstitution(() => ({})))).toBe(true)
  })

  test('returns false for goal factory', () => {
    expect(isConstitutionFactory(createGoal(() => ({})))).toBe(false)
  })
})

describe('isWorkflowFactory', () => {
  test('returns true for workflow factory', () => {
    expect(isWorkflowFactory(createWorkflow(() => ({})))).toBe(true)
  })

  test('returns false for goal factory', () => {
    expect(isWorkflowFactory(createGoal(() => ({})))).toBe(false)
  })
})

// ============================================================================
// Factory Independence
// ============================================================================

describe('factory independence', () => {
  test('different brands produce distinct types', () => {
    const constitution = createConstitution(() => ({}))
    const goal = createGoal(() => ({}))
    const workflow = createWorkflow(() => ({}))

    expect(constitution.$).not.toBe(goal.$)
    expect(goal.$).not.toBe(workflow.$)
    expect(constitution.$).not.toBe(workflow.$)
  })

  test('factories with same create function get distinct brands', () => {
    const sharedCreate = () => ({ threads: {} })
    const constitution = createConstitution(sharedCreate)
    const goal = createGoal(sharedCreate)

    expect(constitution.$).toBe('🏛️')
    expect(goal.$).toBe('🎯')
    // Both share the same create function reference
    expect(constitution.create).toBe(goal.create)
  })
})
