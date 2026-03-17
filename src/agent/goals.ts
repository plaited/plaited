/**
 * Goal persistence — load, save, and remove goal factories from `.memory/goals/`.
 *
 * @remarks
 * Goal factories are TypeScript files branded with `$: '🎯'` that produce
 * bThreads for user/agent-defined objectives. This module handles the full
 * lifecycle: loading persisted goals at spawn (with validation), saving new
 * goals (with validation + MAC protection), and removing goals.
 *
 * Validation uses the 7-check gate from `validate-thread.ts` plus an
 * additional MAC protection check that prevents goal factories from blocking
 * pipeline infrastructure events.
 *
 * @public
 */

import { join, resolve } from 'node:path'
import { type ThreadValidationResult, validateThreadFactory } from '../tools/validate-thread.ts'
import { type GoalFactory, isGoalFactory } from './factories.ts'

// ============================================================================
// MAC Protection
// ============================================================================

/**
 * Pipeline infrastructure events that goal factories must not block.
 *
 * @remarks
 * These events are essential for the agent loop to function. If blocked,
 * the pipeline halts entirely. Only constitution factories (MAC) may
 * block these events.
 *
 * Goals CAN conditionally block `execute` (e.g., "don't deploy on weekends"),
 * but cannot block the pipeline machinery itself.
 *
 * @public
 */
export const MAC_PROTECTED_EVENTS = new Set([
  'invoke_inference',
  'model_response',
  'gate_approved',
  'gate_rejected',
  'task',
  'message',
  'loop_complete',
])

/**
 * Check that a goal factory source does not block MAC-protected events.
 *
 * @remarks
 * Static heuristic — checks whether the source contains `block` declarations
 * that reference MAC-protected event names. Conservative: may produce false
 * positives (e.g., event name in a comment), but won't miss actual violations.
 *
 * @param source - TypeScript source code of the goal factory
 * @returns Validation result with any MAC protection errors
 *
 * @public
 */
export const checkMacProtection = (source: string): { ok: boolean; errors: string[] } => {
  const errors: string[] = []

  // Only check if source contains a block declaration
  const hasBlock = /\bblock\s*[:(]/.test(source)
  if (!hasBlock) return { ok: true, errors }

  for (const event of MAC_PROTECTED_EVENTS) {
    // Check if the MAC-protected event name appears as a string literal
    const eventLiteralPattern = new RegExp(`['"\`]${event}['"\`]`)
    if (eventLiteralPattern.test(source)) {
      errors.push(`Goal factory must not block MAC-protected event: '${event}'`)
    }
  }

  return { ok: errors.length === 0, errors }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Find a goal factory export in a dynamically imported module.
 *
 * @remarks
 * Checks `default` export first, then searches named exports for an
 * object with `$: '🎯'` brand and a `create` function.
 *
 * @internal
 */
const findGoalExport = (mod: Record<string, unknown>): GoalFactory | null => {
  // Check default export first
  if (isGoalFactory(mod.default)) return mod.default

  // Search named exports
  for (const value of Object.values(mod)) {
    if (isGoalFactory(value)) return value
  }

  return null
}

// ============================================================================
// Goal Loading
// ============================================================================

/**
 * Result of loading a single goal factory file.
 *
 * @public
 */
export type GoalLoadResult = {
  path: string
  factory?: GoalFactory
  validation: ThreadValidationResult
  macErrors: string[]
}

/**
 * Load and validate all goal factories from a directory.
 *
 * @remarks
 * Globs for `*.ts` files (excluding `.spec.ts` and `.test.ts`), validates
 * each with the 7-check gate from `validate-thread.ts` plus MAC protection,
 * then dynamically imports valid ones. Invalid factories are skipped with
 * their validation results available in the returned array.
 *
 * @param goalsDir - Absolute path to the goals directory
 * @returns Array of successfully loaded `GoalFactory` instances
 *
 * @public
 */
export const loadPersistedGoals = async (goalsDir: string): Promise<GoalFactory[]> => {
  if (!(await Bun.file(goalsDir).exists())) return []

  const glob = new Bun.Glob('*.ts')
  const factories: GoalFactory[] = []

  for await (const path of glob.scan({ cwd: goalsDir, onlyFiles: true })) {
    // Skip test files
    if (path.endsWith('.spec.ts') || path.endsWith('.test.ts')) continue

    const fullPath = resolve(goalsDir, path)

    // Validate with the 7-check gate
    const validation = await validateThreadFactory(fullPath)
    if (!validation.valid) continue

    // Additional MAC protection check
    const source = await Bun.file(fullPath).text()
    const mac = checkMacProtection(source)
    if (!mac.ok) continue

    // Dynamic import — find the goal factory export
    try {
      const mod = await import(fullPath)
      const factory = findGoalExport(mod)
      if (factory) {
        factories.push(factory)
      }
    } catch {
      // Skip files that fail to import
    }
  }

  return factories
}

/**
 * Load all goal factories with detailed results (including failures).
 *
 * @remarks
 * Like `loadPersistedGoals` but returns validation details for every file,
 * not just the successful ones. Useful for diagnostics and reporting.
 *
 * @param goalsDir - Absolute path to the goals directory
 * @returns Array of load results for every `.ts` file in the directory
 *
 * @public
 */
export const loadPersistedGoalsDetailed = async (goalsDir: string): Promise<GoalLoadResult[]> => {
  if (!(await Bun.file(goalsDir).exists())) return []

  const glob = new Bun.Glob('*.ts')
  const results: GoalLoadResult[] = []

  for await (const path of glob.scan({ cwd: goalsDir, onlyFiles: true })) {
    if (path.endsWith('.spec.ts') || path.endsWith('.test.ts')) continue

    const fullPath = resolve(goalsDir, path)
    const validation = await validateThreadFactory(fullPath)

    let macErrors: string[] = []
    let factory: GoalFactory | undefined

    if (validation.valid) {
      const source = await Bun.file(fullPath).text()
      const mac = checkMacProtection(source)
      macErrors = mac.errors

      if (mac.ok) {
        try {
          const mod = await import(fullPath)
          factory = findGoalExport(mod) ?? undefined
        } catch {
          // Import failed — factory stays undefined
        }
      }
    }

    results.push({ path: fullPath, factory, validation, macErrors })
  }

  return results
}

// ============================================================================
// Goal Saving
// ============================================================================

/**
 * Result of saving a goal factory.
 *
 * @public
 */
export type GoalSaveResult = {
  success: boolean
  path: string
  validation: ThreadValidationResult
  macErrors: string[]
}

/**
 * Write a goal factory to disk and validate it.
 *
 * @remarks
 * Writes the source to `{goalsDir}/{name}.ts`, then runs the full
 * validation gate (7-check + MAC protection). If validation fails,
 * the file is removed and the failure details are returned.
 *
 * The companion `.spec.ts` should already exist (test-first generation
 * pattern) before calling this function.
 *
 * @param goalsDir - Absolute path to the goals directory
 * @param name - Goal name (used as filename without extension)
 * @param source - TypeScript source code for the goal factory
 * @returns Save result with validation details
 *
 * @public
 */
export const saveGoal = async (goalsDir: string, name: string, source: string): Promise<GoalSaveResult> => {
  const filePath = join(goalsDir, `${name}.ts`)

  // Write the factory source
  await Bun.write(filePath, source)

  // Run full validation
  const validation = await validateThreadFactory(filePath)
  const mac = checkMacProtection(source)

  if (!validation.valid || !mac.ok) {
    // Clean up invalid file
    await Bun.$`rm ${filePath}`.quiet().nothrow()
    return {
      success: false,
      path: filePath,
      validation,
      macErrors: mac.errors,
    }
  }

  return {
    success: true,
    path: filePath,
    validation,
    macErrors: [],
  }
}

// ============================================================================
// Goal Removal
// ============================================================================

/**
 * Remove a goal factory and its companion test file.
 *
 * @param goalsDir - Absolute path to the goals directory
 * @param name - Goal name (filename without extension)
 * @returns `true` if the factory existed and was removed
 *
 * @public
 */
export const removeGoal = async (goalsDir: string, name: string): Promise<boolean> => {
  const filePath = join(goalsDir, `${name}.ts`)

  if (!(await Bun.file(filePath).exists())) return false

  // Remove the factory file
  await Bun.$`rm ${filePath}`.quiet()

  // Also remove companion spec if it exists
  const specPath = join(goalsDir, `${name}.spec.ts`)
  if (await Bun.file(specPath).exists()) {
    await Bun.$`rm ${specPath}`.quiet()
  }

  return true
}
