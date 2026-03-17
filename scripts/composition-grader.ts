/**
 * Deterministic MSS composition grader.
 *
 * @remarks
 * Grades two-module compositions from agent output. Validates:
 * 1. Inner module — 6 fields (name format + 5 MSS tags)
 * 2. Outer module — 6 fields
 * 3. Scale nesting — inner.scale < outer.scale
 * 4. Boundary cascade — min(inner.boundary, outer.boundary) = expected effectiveBoundary
 *
 * Total: 14 graded points. Pass = 14/14.
 *
 * @packageDocumentation
 */

import { ModnetFieldSchema } from '../src/modnet/modnet.schemas.ts'
import type { Grader, GraderResult } from '../src/tools/trial.schemas.ts'

// ============================================================================
// Types
// ============================================================================

type SkeletonRef = {
  contentType: string
  structure: string
  mechanics: string[]
  boundary: string
  scale: number
}

type CompositionRef = {
  inner: SkeletonRef
  outer: SkeletonRef
  effectiveBoundary: string
}

// ============================================================================
// Constants
// ============================================================================

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 64

/** Restriction order: higher = more restrictive */
const BOUNDARY_RESTRICTION: Record<string, number> = {
  none: 4,
  paid: 3,
  ask: 2,
  all: 1,
}

const GRADED_FIELDS = ['name', 'contentType', 'structure', 'mechanics', 'boundary', 'scale'] as const
const MSS_FIELDS = ['contentType', 'structure', 'mechanics', 'boundary', 'scale'] as const

// ============================================================================
// Helpers
// ============================================================================

const isValidName = (name: unknown): boolean =>
  typeof name === 'string' &&
  name.length > 0 &&
  name.length <= MAX_NAME_LENGTH &&
  NAME_PATTERN.test(name)

const mechanicsMatch = (actual: string[], expected: string[]): boolean => {
  if (actual.length !== expected.length) return false
  const sorted = (arr: string[]) => [...arr].sort()
  return sorted(actual).every((v, i) => v === sorted(expected)[i])
}

/**
 * Compute the effective boundary from two boundaries.
 * Returns the more restrictive (higher restriction number).
 */
const cascadeBoundary = (a: string, b: string): string => {
  const ra = BOUNDARY_RESTRICTION[a] ?? 0
  const rb = BOUNDARY_RESTRICTION[b] ?? 0
  return ra >= rb ? a : b
}

// ============================================================================
// Single-module grading
// ============================================================================

type FieldResult = { pass: boolean; expected: unknown; actual: unknown }

const gradeModule = (
  actual: Record<string, unknown>,
  ref: SkeletonRef,
): { fieldResults: Record<string, FieldResult>; correct: number; warnings: string[] } => {
  const fieldResults: Record<string, FieldResult> = {}
  const warnings: string[] = []
  let correct = 0

  // Name — format validation only
  const nameValid = isValidName(actual.name)
  fieldResults.name = { pass: nameValid, expected: 'valid kebab-case', actual: actual.name }
  if (nameValid) correct++

  // MSS fields — exact match
  for (const field of MSS_FIELDS) {
    const expected = ref[field]
    const got = actual[field]
    let match = false

    if (field === 'mechanics') {
      const expectedArr = Array.isArray(expected) ? expected : []
      const gotArr = Array.isArray(got) ? got : []
      match = mechanicsMatch(gotArr.map(String), expectedArr.map(String))
    } else if (field === 'scale') {
      match = Number(got) === Number(expected)
    } else {
      match = String(got) === String(expected)
    }

    fieldResults[field] = { pass: match, expected, actual: got }
    if (match) correct++
  }

  // Schema validation
  const schemaResult = ModnetFieldSchema.safeParse({
    contentType: actual.contentType,
    structure: actual.structure,
    mechanics: actual.mechanics,
    boundary: actual.boundary,
    scale: actual.scale,
  })
  if (!schemaResult.success) {
    warnings.push(`Schema invalid: ${schemaResult.error.issues.map((i) => i.message).join(', ')}`)
  }

  return { fieldResults, correct, warnings }
}

// ============================================================================
// JSON extraction
// ============================================================================

const extractJson = (output: string): unknown => {
  try {
    return JSON.parse(output.trim())
  } catch {
    // continue
  }

  const fenceMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // continue
    }
  }

  const braceStart = output.indexOf('{')
  const braceEnd = output.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(output.slice(braceStart, braceEnd + 1))
    } catch {
      // continue
    }
  }

  return undefined
}

// ============================================================================
// Grader
// ============================================================================

/**
 * Grade a two-module composition against reference MSS tags.
 *
 * @remarks
 * Expects `metadata.inner`, `metadata.outer`, and `metadata.effectiveBoundary`
 * in the grader context. The agent output must be a JSON object with "inner"
 * and "outer" keys, each containing a module skeleton.
 *
 * @public
 */
export const grade: Grader = async ({ output, metadata }) => {
  const ref = metadata as CompositionRef | undefined
  if (!ref?.inner || !ref?.outer) {
    return { pass: false, score: 0, reasoning: 'No reference composition in metadata' }
  }

  const parsed = extractJson(output)
  if (!parsed || typeof parsed !== 'object') {
    return { pass: false, score: 0, reasoning: `Could not parse JSON: ${output.slice(0, 200)}` }
  }

  const actual = parsed as Record<string, unknown>

  // Extract inner and outer from the output
  const innerRaw = actual.inner
  const outerRaw = actual.outer
  if (!innerRaw || typeof innerRaw !== 'object') {
    return { pass: false, score: 0, reasoning: 'No "inner" key in output' }
  }
  if (!outerRaw || typeof outerRaw !== 'object') {
    return { pass: false, score: 0, reasoning: 'No "outer" key in output' }
  }

  const inner = innerRaw as Record<string, unknown>
  const outer = outerRaw as Record<string, unknown>

  // Grade each module
  const innerGrade = gradeModule(inner, ref.inner)
  const outerGrade = gradeModule(outer, ref.outer)

  let totalCorrect = innerGrade.correct + outerGrade.correct
  const TOTAL_MODULE_FIELDS = GRADED_FIELDS.length * 2 // 12

  // ── Composition rules (2 points) ──────────────────────────────────────────

  const innerScale = Number(inner.scale)
  const outerScale = Number(outer.scale)
  const scaleNestingValid = !isNaN(innerScale) && !isNaN(outerScale) && innerScale < outerScale

  const innerBoundary = String(inner.boundary ?? '')
  const outerBoundary = String(outer.boundary ?? '')
  const computedEffective = cascadeBoundary(innerBoundary, outerBoundary)
  const boundaryCascadeCorrect = computedEffective === ref.effectiveBoundary

  if (scaleNestingValid) totalCorrect++
  if (boundaryCascadeCorrect) totalCorrect++

  const TOTAL_POINTS = TOTAL_MODULE_FIELDS + 2 // 14

  // ── Build reasoning ───────────────────────────────────────────────────────

  const allWarnings = [...innerGrade.warnings, ...outerGrade.warnings]

  const innerMismatches = GRADED_FIELDS.filter((f) => !innerGrade.fieldResults[f]?.pass)
    .map((f) => {
      const fr = innerGrade.fieldResults[f]!
      return `inner.${f}(expected:${JSON.stringify(fr.expected)},got:${JSON.stringify(fr.actual)})`
    })

  const outerMismatches = GRADED_FIELDS.filter((f) => !outerGrade.fieldResults[f]?.pass)
    .map((f) => {
      const fr = outerGrade.fieldResults[f]!
      return `outer.${f}(expected:${JSON.stringify(fr.expected)},got:${JSON.stringify(fr.actual)})`
    })

  const compositionIssues: string[] = []
  if (!scaleNestingValid) {
    compositionIssues.push(`scaleNesting(expected:inner<outer, got:${innerScale}<${outerScale}=false)`)
  }
  if (!boundaryCascadeCorrect) {
    compositionIssues.push(
      `boundaryCascade(expected:${ref.effectiveBoundary}, got:cascade(${innerBoundary},${outerBoundary})=${computedEffective})`,
    )
  }

  const allMismatches = [...innerMismatches, ...outerMismatches, ...compositionIssues]
  const pass = totalCorrect === TOTAL_POINTS
  const score = totalCorrect / TOTAL_POINTS

  const parts: string[] = []
  if (pass) {
    parts.push('All 14 composition points valid')
  } else {
    parts.push(`${totalCorrect}/${TOTAL_POINTS} points. Mismatches: ${allMismatches.join(', ')}`)
  }
  if (allWarnings.length > 0) {
    parts.push(`Warnings: ${allWarnings.join('; ')}`)
  }

  return {
    pass,
    score,
    reasoning: parts.join('. '),
    dimensions: { outcome: score },
  } satisfies GraderResult
}
