import { describe, expect, test } from 'bun:test'

import { CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT, WORK_ITEM_LIFECYCLE_STATES } from '../plan.ts'

const REQUIRED_LIFECYCLE_STATES = [
  'draft',
  'discovery_ready',
  'formulated',
  'red_pending',
  'red_approved',
  'green_pending',
  'review_pending',
  'merge_ready',
  'merged',
  'cleanup_pending',
  'cleaned',
  'blocked',
  'rejected',
] as const

describe('work-item orchestration contract', () => {
  test('defines the canonical minimum lifecycle states from issue #334', () => {
    expect(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.initialState).toBe(WORK_ITEM_LIFECYCLE_STATES.draft)

    const stateSet = new Set(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.states.map((state) => state.id))
    for (const state of REQUIRED_LIFECYCLE_STATES) {
      expect(stateSet.has(state)).toBeTrue()
    }
  })

  test('declares explicit machine-checkable guard contract for green gating, dependencies, and merge qualification', () => {
    const transitionToRedPending = CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.transitions.find(
      (transition) => transition.to === WORK_ITEM_LIFECYCLE_STATES.red_pending,
    )
    const transitionToGreenPending = CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.transitions.find(
      (transition) => transition.to === WORK_ITEM_LIFECYCLE_STATES.green_pending,
    )
    const transitionToMergeReady = CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.transitions.find(
      (transition) => transition.to === WORK_ITEM_LIFECYCLE_STATES.merge_ready,
    )

    expect(transitionToRedPending).toBeDefined()
    expect(transitionToRedPending?.guardIds).toContain('dependencies_resolved')
    expect(transitionToGreenPending).toBeDefined()
    expect(transitionToGreenPending?.guardIds).toContain('dependencies_resolved')
    expect(transitionToGreenPending?.guardIds).toContain('red_approval_is_fresh')
    expect(transitionToMergeReady).toBeDefined()
    expect(transitionToMergeReady?.guardIds).toContain('dependencies_resolved')
    expect(transitionToMergeReady?.guardIds).toContain('merge_gate_passed')
    expect(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.guards.dependencies_resolved).toBeDefined()
    expect(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.guards.red_approval_is_fresh).toBeDefined()
    expect(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.guards.merge_gate_passed).toEqual({
      id: 'merge_gate_passed',
      description: 'Latest merge simulation gate approved with required merge-eligible checks.',
      check: 'latest_merge_simulation_approved_with_required_checks',
      facts: ['latest_merge_simulation_decision', 'latest_merge_simulation_required_checks'],
    })
  })

  test('models cleanup as first-class lifecycle plus deadlock/interruption runtime semantics', () => {
    const hasCleanupPath = CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.transitions.some(
      (transition) =>
        transition.from === WORK_ITEM_LIFECYCLE_STATES.merged &&
        transition.to === WORK_ITEM_LIFECYCLE_STATES.cleanup_pending,
    )
    expect(hasCleanupPath).toBeTrue()

    const hasDeadlockHook = CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.runtime.deadlock.onNoEnabledTransition.some(
      (hook) => hook.to === WORK_ITEM_LIFECYCLE_STATES.blocked && hook.event === 'deadlock_detected',
    )
    expect(hasDeadlockHook).toBeTrue()

    const hasInterruptionHook = CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.runtime.interruptions.some(
      (hook) => hook.to === WORK_ITEM_LIFECYCLE_STATES.blocked,
    )
    expect(hasInterruptionHook).toBeTrue()
  })

  test('declares machine-checkable dual-model role assumptions', () => {
    expect(CANONICAL_WORK_ITEM_ORCHESTRATION_CONTRACT.roles).toEqual({
      implementer: {
        actorType: 'agent',
        actorId: 'codex-5.3',
        modelId: 'codex-5.3',
        description: 'Implementation execution authority for green worktree changes.',
      },
      gateAuthority: {
        actorType: 'agent',
        actorId: 'gpt-5.5',
        modelId: 'gpt-5.5',
        description: 'Reviewer and gate authority for red approval, frontier verification, and merge qualification.',
      },
    })
  })
})
