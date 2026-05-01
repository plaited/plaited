import { describe, expect, test } from 'bun:test'
import * as z from 'zod'

import {
  BPEventSchema,
  DeadlockSnapshotSchema,
  FrontierSnapshotSchema,
  SelectionSnapshotSchema,
  SnapshotCandidateSchema,
  SnapshotEventSchema,
  SnapshotMessageSchema,
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

describe('actor kernel schemas', () => {
  test('FrontierSnapshotSchema exports JSON Schema with step, status, candidates, and enabled as required fields', () => {
    const schema = z.toJSONSchema(FrontierSnapshotSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['kind', 'step', 'status', 'candidates', 'enabled']))
  })

  test('DeadlockSnapshotSchema exports JSON Schema with kind and step as required fields', () => {
    const schema = z.toJSONSchema(DeadlockSnapshotSchema)
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
      SnapshotMessageSchema.parse({
        kind: 'selection',
        step: 0,
        selected: {
          type: 'event',
          detail: () => 'not json',
        },
      }),
    ).toThrow()
  })

  test('SelectionSnapshotSchema accepts selected event payload', () => {
    expect(
      SelectionSnapshotSchema.parse({
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
})
