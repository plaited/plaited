/**
 * Branded factory types and helpers for bThread generation.
 *
 * @remarks
 * Three factory brands share the same return shape `{ threads?, handlers? }`:
 *
 * - `🏛️` constitution — MAC rules, immutable at spawn, loaded by governance
 * - `🎯` goal — user/agent-defined objectives, loaded from `.memory/goals/`
 * - `🔄` workflow — task-specific coordination patterns, ephemeral
 *
 * Helper factories (`createConstitution`, `createGoal`, `createWorkflow`)
 * brand the output so consumers can distinguish categories at the type level.
 *
 * @public
 */

import type { DefaultHandlers, RulesFunction, Trigger } from '../behavioral/behavioral.types.ts'

// ============================================================================
// Factory Brands
// ============================================================================

/**
 * Brand constants for the three factory categories.
 *
 * @remarks
 * Extends the codebase's `$` brand pattern:
 * `🪢` RulesFunction, `🦄` templates, `🎛️` ControllerTemplate, `🎨` DecoratorTemplate.
 *
 * @public
 */
export const FACTORY_BRANDS = {
  constitution: '🏛️',
  goal: '🎯',
  workflow: '🔄',
} as const

// ============================================================================
// Factory Result
// ============================================================================

/**
 * Shared return shape for all factory brands.
 *
 * @remarks
 * A factory's `create` method returns threads (bThreads to add to the engine)
 * and/or handlers (feedback handlers to register via `useFeedback`).
 * Both are optional — a constitution factory might only produce threads,
 * while a workflow factory might produce both.
 *
 * @public
 */
export type FactoryResult = {
  threads?: Record<string, RulesFunction>
  handlers?: DefaultHandlers
}

// ============================================================================
// Branded Factory Types
// ============================================================================

/**
 * Generic branded factory — parameterized by brand literal.
 *
 * @public
 */
export type BrandedFactory<B extends string> = {
  $: B
  create: (trigger: Trigger) => FactoryResult
}

/** MAC rules factory — immutable at spawn, framework-provided. */
export type ConstitutionFactory = BrandedFactory<'🏛️'>

/** User/agent-defined objective factory — loaded from `.memory/goals/`. */
export type GoalFactory = BrandedFactory<'🎯'>

/** Task-specific coordination factory — ephemeral, created at runtime. */
export type WorkflowFactory = BrandedFactory<'🔄'>

/** Union of all factory brands for runtime discrimination. */
export type AnyFactory = ConstitutionFactory | GoalFactory | WorkflowFactory

// ============================================================================
// Helper Factories
// ============================================================================

/**
 * Brand a create function as a constitution factory.
 *
 * @param create - Factory function that receives a `Trigger` and returns threads/handlers
 * @returns Branded `ConstitutionFactory`
 *
 * @public
 */
export const createConstitution = (create: (trigger: Trigger) => FactoryResult): ConstitutionFactory => ({
  $: '🏛️',
  create,
})

/**
 * Brand a create function as a goal factory.
 *
 * @param create - Factory function that receives a `Trigger` and returns threads/handlers
 * @returns Branded `GoalFactory`
 *
 * @public
 */
export const createGoal = (create: (trigger: Trigger) => FactoryResult): GoalFactory => ({
  $: '🎯',
  create,
})

/**
 * Brand a create function as a workflow factory.
 *
 * @param create - Factory function that receives a `Trigger` and returns threads/handlers
 * @returns Branded `WorkflowFactory`
 *
 * @public
 */
export const createWorkflow = (create: (trigger: Trigger) => FactoryResult): WorkflowFactory => ({
  $: '🔄',
  create,
})

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check whether a value is a branded factory of any kind.
 *
 * @public
 */
export const isBrandedFactory = (value: unknown): value is AnyFactory =>
  typeof value === 'object' &&
  value !== null &&
  '$' in value &&
  typeof (value as AnyFactory).$ === 'string' &&
  Object.values(FACTORY_BRANDS).includes((value as AnyFactory).$ as '🏛️' | '🎯' | '🔄') &&
  'create' in value &&
  typeof (value as AnyFactory).create === 'function'

/**
 * Check whether a value is a goal factory specifically.
 *
 * @public
 */
export const isGoalFactory = (value: unknown): value is GoalFactory =>
  isBrandedFactory(value) && value.$ === FACTORY_BRANDS.goal

/**
 * Check whether a value is a constitution factory specifically.
 *
 * @public
 */
export const isConstitutionFactory = (value: unknown): value is ConstitutionFactory =>
  isBrandedFactory(value) && value.$ === FACTORY_BRANDS.constitution

/**
 * Check whether a value is a workflow factory specifically.
 *
 * @public
 */
export const isWorkflowFactory = (value: unknown): value is WorkflowFactory =>
  isBrandedFactory(value) && value.$ === FACTORY_BRANDS.workflow
