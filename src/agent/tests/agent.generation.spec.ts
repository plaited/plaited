import { describe, expect, test } from 'bun:test'
import type { ThreadValidationResult } from '../../tools/validate-thread.ts'
import type { GenerationRequest, GenerationResult } from '../agent.generation.ts'

// ============================================================================
// GenerationRequest type contract
// ============================================================================

describe('GenerationRequest', () => {
  test('accepts goal kind', () => {
    const request: GenerationRequest = {
      kind: 'goal',
      description: 'Watch for emails from alice@example.com',
    }
    expect(request.kind).toBe('goal')
    expect(request.description).toBeDefined()
  })

  test('accepts workflow kind', () => {
    const request: GenerationRequest = {
      kind: 'workflow',
      description: 'Generate daily report at 9am',
    }
    expect(request.kind).toBe('workflow')
  })

  test('accepts optional constraints', () => {
    const request: GenerationRequest = {
      kind: 'goal',
      description: 'Monitor server health',
      constraints: ['Must repeat indefinitely', 'Must not block execute'],
    }
    expect(request.constraints).toHaveLength(2)
  })

  test('constraints are optional', () => {
    const request: GenerationRequest = {
      kind: 'goal',
      description: 'Simple goal',
    }
    expect(request.constraints).toBeUndefined()
  })
})

// ============================================================================
// GenerationResult type contract
// ============================================================================

describe('GenerationResult', () => {
  const mockValidation: ThreadValidationResult = {
    valid: true,
    path: '/test/goals/watch-alice.ts',
    errors: [],
    warnings: [],
    factory: {
      brand: '🎯',
      name: 'watch-alice',
      threadNames: ['goal_watch_alice'],
    },
  }

  test('accepts goal brand result', () => {
    const result: GenerationResult = {
      specPath: '/test/goals/watch-alice.spec.ts',
      implPath: '/test/goals/watch-alice.ts',
      validation: mockValidation,
      brand: '🎯',
    }
    expect(result.brand).toBe('🎯')
    expect(result.validation.valid).toBe(true)
  })

  test('accepts workflow brand result', () => {
    const result: GenerationResult = {
      specPath: '/test/workflows/daily-report.spec.ts',
      implPath: '/test/workflows/daily-report.ts',
      validation: { ...mockValidation, factory: { ...mockValidation.factory!, brand: '🔄' } },
      brand: '🔄',
    }
    expect(result.brand).toBe('🔄')
  })

  test('captures failed validation', () => {
    const failedValidation: ThreadValidationResult = {
      valid: false,
      path: '/test/goals/bad-goal.ts',
      errors: ['Parse error', 'Brand mismatch'],
      warnings: [],
    }
    const result: GenerationResult = {
      specPath: '/test/goals/bad-goal.spec.ts',
      implPath: '/test/goals/bad-goal.ts',
      validation: failedValidation,
      brand: '🎯',
    }
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors).toHaveLength(2)
  })
})
