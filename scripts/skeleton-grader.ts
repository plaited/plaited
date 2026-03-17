/**
 * Deterministic module skeleton grader.
 *
 * @remarks
 * Parses agent output to extract a module skeleton (name + MSS tags) and validates:
 * 1. Name format — kebab-case, 1–64 chars
 * 2. ModnetFieldSchema gate — structural validity of MSS fields
 * 3. Structure–scale compatibility — valid structure for the scale level
 * 4. Field-by-field exact match against reference MSS tags
 *
 * Scores 6 fields: name (format) + contentType + structure + mechanics + boundary + scale.
 *
 * Conforms to the `Grader` function signature from `trial.schemas.ts`.
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

// ============================================================================
// Constants
// ============================================================================

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME_LENGTH = 64

const GRADED_FIELDS = ['name', 'contentType', 'structure', 'mechanics', 'boundary', 'scale'] as const
const MSS_FIELDS = ['contentType', 'structure', 'mechanics', 'boundary', 'scale'] as const

/**
 * Structure–scale compatibility table (S1–S4).
 *
 * @remarks
 * S4 inherits all structures from S1–S3 per MSS composition rules.
 *
 * @internal
 */
const VALID_STRUCTURES: Record<number, Set<string>> = {
  1: new Set(['object', 'form']),
  2: new Set(['object', 'list', 'collection', 'steps', 'form']),
  3: new Set(['pool', 'stream', 'feed', 'wall', 'thread', 'form', 'collection', 'steps']),
  4: new Set([
    'object', 'list', 'collection', 'steps', 'form',
    'pool', 'stream', 'feed', 'wall', 'thread',
  ]),
}

// ============================================================================
// JSON extraction
// ============================================================================

/**
 * Extract a JSON object from agent output that may contain markdown
 * code fences, explanatory text, or other non-JSON content.
 *
 * @internal
 */
const extractJson = (output: string): unknown => {
  // Try 1: direct parse
  try {
    return JSON.parse(output.trim())
  } catch {
    // continue
  }

  // Try 2: extract from markdown code fence
  const fenceMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim())
    } catch {
      // continue
    }
  }

  // Try 3: find first { ... } block
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
// Field comparison
// ============================================================================

/**
 * Compare two mechanics arrays as unordered sets.
 *
 * @internal
 */
const mechanicsMatch = (actual: string[], expected: string[]): boolean => {
  if (actual.length !== expected.length) return false
  const sorted = (arr: string[]) => [...arr].sort()
  const a = sorted(actual)
  const b = sorted(expected)
  return a.every((v, i) => v === b[i])
}

/**
 * Validate module name format (kebab-case).
 *
 * @internal
 */
const isValidName = (name: unknown): boolean =>
  typeof name === 'string' &&
  name.length > 0 &&
  name.length <= MAX_NAME_LENGTH &&
  NAME_PATTERN.test(name)

// ============================================================================
// Grader
// ============================================================================

/**
 * Grade a module skeleton against reference MSS tags.
 *
 * @remarks
 * Expects `metadata.skeleton` to contain the reference MSS tags:
 * `{ contentType, structure, mechanics, boundary, scale }`.
 *
 * The agent output should contain a JSON object with `name` plus the 5 MSS fields.
 *
 * @public
 */
export const grade: Grader = async ({ output, metadata }) => {
  const ref = metadata?.skeleton as SkeletonRef | undefined
  if (!ref) {
    return {
      pass: false,
      score: 0,
      reasoning: 'No reference skeleton found in metadata.skeleton',
    }
  }

  const parsed = extractJson(output)
  if (!parsed || typeof parsed !== 'object') {
    return {
      pass: false,
      score: 0,
      reasoning: `Could not parse JSON from output: ${output.slice(0, 200)}`,
    }
  }

  const actual = parsed as Record<string, unknown>

  // ── Field-by-field grading ──────────────────────────────────────────────

  const fieldResults: Record<string, { pass: boolean; expected: unknown; actual: unknown }> = {}
  let correct = 0
  const warnings: string[] = []

  // 1. Name — format validation only (no exact match)
  const nameValid = isValidName(actual.name)
  fieldResults.name = {
    pass: nameValid,
    expected: 'valid kebab-case',
    actual: actual.name,
  }
  if (nameValid) correct++

  // 2–6. MSS fields — exact match against reference
  for (const field of MSS_FIELDS) {
    const expected = ref[field]
    const got = actual[field]
    let match = false

    if (field === 'mechanics') {
      const expectedArr = Array.isArray(expected) ? expected : []
      const gotArr = Array.isArray(got) ? got : []
      match = mechanicsMatch(
        gotArr.map(String),
        expectedArr.map(String),
      )
    } else if (field === 'scale') {
      match = Number(got) === Number(expected)
    } else {
      match = String(got) === String(expected)
    }

    fieldResults[field] = { pass: match, expected, actual: got }
    if (match) correct++
  }

  // ── ModnetFieldSchema validation gate ─────────────────────────────────

  const mssInput = {
    contentType: actual.contentType,
    structure: actual.structure,
    mechanics: actual.mechanics,
    boundary: actual.boundary,
    scale: actual.scale,
  }
  const schemaResult = ModnetFieldSchema.safeParse(mssInput)
  if (!schemaResult.success) {
    warnings.push(`ModnetFieldSchema validation failed: ${schemaResult.error.issues.map((i) => i.message).join(', ')}`)
  }

  // ── Structure–scale compatibility ─────────────────────────────────────

  const scale = Number(actual.scale)
  const structure = String(actual.structure ?? '')
  const validSet = VALID_STRUCTURES[scale]
  if (validSet && !validSet.has(structure)) {
    warnings.push(`Structure "${structure}" is not valid at scale S${scale}`)
  }

  // ── Compose result ────────────────────────────────────────────────────

  const score = correct / GRADED_FIELDS.length
  const pass = correct === GRADED_FIELDS.length

  const mismatches = GRADED_FIELDS.filter((f) => !fieldResults[f]!.pass)
  const mismatchDetails = mismatches.map((f) => {
    const fr = fieldResults[f]!
    return `${f} (expected: ${JSON.stringify(fr.expected)}, got: ${JSON.stringify(fr.actual)})`
  })

  const parts: string[] = []
  if (pass) {
    parts.push('All 6 skeleton fields valid')
  } else {
    parts.push(`${correct}/${GRADED_FIELDS.length} fields correct. Mismatches: ${mismatchDetails.join(', ')}`)
  }
  if (warnings.length > 0) {
    parts.push(`Warnings: ${warnings.join('; ')}`)
  }

  return {
    pass,
    score,
    reasoning: parts.join('. '),
    outcome: { fieldResults, schemaValid: schemaResult.success, warnings },
    dimensions: { outcome: score },
  } satisfies GraderResult
}
