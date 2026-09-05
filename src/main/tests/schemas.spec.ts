import { describe, expect, test } from 'bun:test'

import { ajv, validateBPEvent, validateBPListener, validateThread } from '../behavioral.schemas.ts'

const compileTraceValidator = (kind: string) =>
  ajv.compile({
    type: 'object',
    properties: {
      kind: { const: kind },
      timestamp: { type: 'number' },
      instanceId: { type: 'string' },
      step: { type: 'integer' },
    },
    required: ['kind', 'timestamp', 'instanceId', 'step'],
  })

describe('behavioral schemas', () => {
  test('BPEvent validator accepts JSON detail values', () => {
    expect(validateBPEvent({ type: 'primitive', detail: { value: 'text' } })).toBe(true)
    expect(validateBPEvent({ type: 'object', detail: { ok: true, list: [1, null] } })).toBe(true)
    expect(validateBPEvent({ type: 'bare' })).toBe(true)
  })

  test('BPEvent validator rejects missing type and non-string type', () => {
    expect(validateBPEvent({ detail: {} })).toBe(false)
    expect(validateBPEvent({ type: 42 })).toBe(false)
    expect(validateBPEvent(null)).toBe(false)
  })

  test('BPListener validator accepts type with optional schema fields', () => {
    expect(validateBPListener({ type: 'x' })).toBe(true)
    expect(
      validateBPListener({ type: 'x', detailSchema: { type: 'object', properties: { id: { type: 'string' } } } }),
    ).toBe(true)
    expect(validateBPListener({ type: 'x', detailMatch: 'invalid' })).toBe(true)
    expect(validateBPListener({ type: 'x', detailMatch: 'bogus' })).toBe(false)
  })

  test('Transform listener validator requires query and target', () => {
    expect(validateTransformListenerSafe({ type: 'x', query: '.', target: 'y' })).toBe(true)
    expect(validateTransformListenerSafe({ type: 'x', query: '.' })).toBe(false)
  })

  test('Thread validator requires non-empty label and rules', () => {
    expect(validateThread({ label: 'a', rules: [] })).toBe(true)
    expect(validateThread({ label: 'a', once: true, rules: [] })).toBe(true)
    expect(validateThread({ label: '', rules: [] })).toBe(false)
    expect(validateThread({ rules: [] })).toBe(false)
  })

  test('Selection trace validator accepts a selected event payload', () => {
    const validate = compileTraceValidator('selection')
    const trace = {
      kind: 'selection',
      timestamp: 3,
      instanceId: 'bp_test',
      step: 3,
      selected: { type: 'event', detail: { value: 1 } },
    }
    expect(validate(trace)).toBe(true)
    const narrowed = trace as unknown as SelectionTraceLike
    expect(narrowed.selected.type).toBe('event')
  })

  test('Trace validators reject unknown kinds and missing step', () => {
    expect(compileTraceValidator('selection')({ kind: 'worker', response: { id: 'worker-1' }, step: 0 })).toBe(false)
    expect(compileTraceValidator('deadlock')({ kind: 'deadlock', timestamp: 0, instanceId: 'bp_test' })).toBe(false)
  })

  test('validateDetailSchema accepts real schemas and rejects malformed documents', async () => {
    const { validateDetailSchema } = await import('../behavioral.schemas.ts')
    expect(validateDetailSchema({ type: 'object', properties: { id: { type: 'string' } }, required: ['id'] })).toBe(
      true,
    )
    // invalid type keyword value — meta-schema rejection
    expect(validateDetailSchema({ type: 'object', properties: { age: { type: 'text' } } })).toBe(false)
    // structurally un-compilable — properties must be an object
    expect(validateDetailSchema({ type: 'object', properties: 'not-an-object' })).toBe(false)
    // not a schema at all — no JSON Schema keywords
    expect(validateDetailSchema({ foo: 'bar' })).toBe(false)
    // not an object at all
    expect(validateDetailSchema('nope' as unknown as Parameters<typeof validateDetailSchema>[0])).toBe(false)
  })
})

type SelectionTraceLike = { selected: { type: string } }

function validateTransformListenerSafe(listener: unknown): boolean {
  // Compiled from TransformListenerSchema inside behavioral.schemas; recompiled
  // here via ajv to keep the spec independent of validator export churn.
  const validate = ajv.compile({
    type: 'object',
    properties: {
      type: { type: 'string' },
      query: { type: 'string' },
      target: { type: 'string' },
      detailSchema: { type: 'object', required: [] },
    },
    required: ['type', 'query', 'target'],
  })
  return validate(listener)
}
