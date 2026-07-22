import { describe, expect, test } from 'bun:test'
import * as z from 'zod'

import {
  AddThreadErrorSchema,
  BPEventSchema,
  BPListenerSchema,
  DeadlockTraceSchema,
  FrontieTraceSchema,
  SelectionTraceSchema,
  SnapshotCandidateSchema,
  SnapshotEventSchema,
  TraceSchema,
} from '../behavioral.schemas.ts'

type JsonSchemaShape = {
  required?: unknown
  properties?: Record<string, unknown>
}

const readRequired = (schema: unknown): string[] => {
  const required = (schema as JsonSchemaShape).required
  expect(Array.isArray(required)).toBe(true)
  return required as string[]
}

describe('behavioral schemas', () => {
  test('FrontierSnapshotSchema exports JSON Schema with step, status, candidates, and enabled as required fields', () => {
    const schema = z.toJSONSchema(FrontieTraceSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['kind', 'step', 'status', 'candidates', 'enabled']))
  })

  test('DeadlockSnapshotSchema exports JSON Schema with kind and step as required fields', () => {
    const schema = z.toJSONSchema(DeadlockTraceSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['kind', 'step']))
  })

  test('SnapshotEventSchema accepts optional ingress', () => {
    expect(SnapshotEventSchema.parse({ type: 'worker.done' })).toEqual({
      type: 'worker.done',
    })
    expect(SnapshotEventSchema.parse({ type: 'worker.done', ingress: true })).toEqual({
      type: 'worker.done',
      ingress: true,
    })
  })

  test('SnapshotCandidateSchema rejects non-JSON detail values like functions', () => {
    expect(() =>
      SnapshotCandidateSchema.parse({
        type: 'evt',
        detail: {
          fn: () => 'not json',
        },
        priority: 1,
      }),
    ).toThrow()
  })

  test('BPEventSchema accepts JSON detail values', () => {
    expect(BPEventSchema.parse({ type: 'primitive', detail: { value: 'text' } })).toEqual({
      type: 'primitive',
      detail: { value: 'text' },
    })
    expect(BPEventSchema.parse({ type: 'object', detail: { ok: true, list: [1, null] } })).toEqual({
      type: 'object',
      detail: { ok: true, list: [1, null] },
    })
  })

  test('SnapshotMessageSchema rejects non-JSON selected event detail values', () => {
    expect(() =>
      TraceSchema.parse({
        kind: 'selection',
        step: 0,
        selected: {
          type: 'event',
          detail: () => 'not json',
        },
      }),
    ).toThrow()
  })

  test('SnapshotMessageSchema rejects worker protocol messages', () => {
    expect(() =>
      TraceSchema.parse({
        kind: 'worker',
        response: {
          id: 'worker-1',
        },
      }),
    ).toThrow()
  })

  test('SelectionSnapshotSchema accepts selected event payload', () => {
    expect(
      SelectionTraceSchema.parse({
        kind: 'selection',
        step: 3,
        selected: {
          type: 'event',
          detail: { value: 1 },
        },
      }),
    ).toEqual({
      kind: 'selection',
      step: 3,
      selected: {
        type: 'event',
        detail: { value: 1 },
      },
    })
  })

  test('BPListenerSchema rejects detailSchema without JSON Schema keywords', () => {
    // A plain object with no recognizable JSON Schema keywords should be rejected
    expect(BPListenerSchema.safeParse({ type: 'x', detailSchema: { foo: 'bar' } }).success).toBe(false)

    // A valid JSON Schema object should parse
    expect(
      BPListenerSchema.safeParse({
        type: 'x',
        detailSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
          additionalProperties: false,
        },
      }).success,
    ).toBe(true)

    // detailSchema with $ref should also parse
    expect(
      BPListenerSchema.safeParse({
        type: 'x',
        detailSchema: { $ref: '#/$defs/MyType' },
      }).success,
    ).toBe(true)

    // detailSchema with enum should parse
    expect(
      BPListenerSchema.safeParse({
        type: 'x',
        detailSchema: { enum: ['a', 'b', 'c'] },
      }).success,
    ).toBe(true)

    // Missing detailSchema (undefined) should still parse (optional field)
    expect(BPListenerSchema.safeParse({ type: 'x' }).success).toBe(true)
  })

  test('AddThreadErrorSchema accepts string error messages', () => {
    expect(AddThreadErrorSchema.safeParse({ kind: 'add_thread_error', error: 'something went wrong' }).success).toBe(
      true,
    )
  })

  test('AddThreadErrorSchema accepts ZodIssue array errors', () => {
    expect(
      AddThreadErrorSchema.safeParse({
        kind: 'add_thread_error',
        error: [{ code: 'invalid_type', path: [], message: 'Expected string, received number' }],
      }).success,
    ).toBe(true)
  })
})
