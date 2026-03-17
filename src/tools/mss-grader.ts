/**
 * Deterministic MSS classification grader.
 *
 * @remarks
 * Parses agent output to extract MSS tags and compares each field against
 * reference values from `metadata.mss`. Exact match on scalar fields,
 * order-independent set comparison on `mechanics` array.
 *
 * Conforms to the `Grader` function signature from `trial.schemas.ts`.
 *
 * @packageDocumentation
 */

import type { Grader, GraderResult } from './trial.schemas.ts'

// ============================================================================
// Types
// ============================================================================

type MssTags = {
  contentType: string
  structure: string
  mechanics: string[]
  boundary: string
  scale: number
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

// ============================================================================
// Grader
// ============================================================================

const MSS_FIELDS = ['contentType', 'structure', 'mechanics', 'boundary', 'scale'] as const

/**
 * Grade an MSS classification against reference tags.
 *
 * @remarks
 * Expects `metadata.mss` to contain the reference MSS tags:
 * `{ contentType, structure, mechanics, boundary, scale }`.
 *
 * The agent output should contain a JSON object with the same 5 fields.
 *
 * @public
 */
export const grade: Grader = async ({ output, metadata }) => {
  const ref = metadata?.mss as MssTags | undefined
  if (!ref) {
    return {
      pass: false,
      score: 0,
      reasoning: 'No reference MSS tags found in metadata.mss',
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
  const fieldResults: Record<string, { pass: boolean; expected: unknown; actual: unknown }> = {}
  let correct = 0

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

  const score = correct / MSS_FIELDS.length
  const pass = correct === MSS_FIELDS.length

  const mismatches = MSS_FIELDS.filter((f) => !fieldResults[f]!.pass)
  const reasoning = pass
    ? 'All 5 MSS fields match exactly'
    : `${correct}/${MSS_FIELDS.length} fields correct. Mismatches: ${mismatches
        .map((f) => `${f} (expected: ${JSON.stringify(fieldResults[f]!.expected)}, got: ${JSON.stringify(fieldResults[f]!.actual)})`)
        .join(', ')}`

  return {
    pass,
    score,
    reasoning,
    outcome: { fieldResults },
    dimensions: { outcome: score },
  } satisfies GraderResult
}
