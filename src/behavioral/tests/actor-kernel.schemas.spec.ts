import { describe, expect, test } from 'bun:test'
import * as z from 'zod'

import {
  BPEventSchema,
  DeadlockSnapshotSchema,
  SnapshotMessageSchema,
  ThreadReferenceSchema,
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
  test('ThreadReferenceSchema exports JSON Schema with label as required field', () => {
    const schema = z.toJSONSchema(ThreadReferenceSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['label']))
    expect(required).toHaveLength(1)
  })

  test('DeadlockSnapshotSchema exports JSON Schema with bids and summary as required fields', () => {
    const schema = z.toJSONSchema(DeadlockSnapshotSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['kind', 'bids', 'summary']))
  })

  test('ThreadReferenceSchema accepts optional id for instance-level snapshots', () => {
    expect(ThreadReferenceSchema.parse({ label: 'worker' })).toEqual({
      label: 'worker',
    })
    expect(ThreadReferenceSchema.parse({ label: 'worker', id: 'bthread:1' })).toEqual({
      label: 'worker',
      id: 'bthread:1',
    })
  })

  test('DeadlockSnapshotSchema rejects non-JSON bid detail values like functions', () => {
    expect(() =>
      DeadlockSnapshotSchema.parse({
        kind: 'deadlock',
        bids: [
          {
            thread: { label: 'producer', id: 'bthread:1' },
            source: 'request',
            selected: false,
            type: 'evt',
            detail: {
              fn: () => 'not json',
            },
            priority: 1,
            reason: 'blocked',
            blockedBy: { label: 'guard', id: 'bthread:2' },
          },
        ],
        summary: {
          candidateCount: 1,
          blockedCount: 1,
          unblockedCount: 0,
          blockers: [{ label: 'guard', id: 'bthread:2' }],
          interrupters: [],
        },
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

  test('SnapshotMessageSchema rejects non-JSON bid detail values', () => {
    expect(() =>
      SnapshotMessageSchema.parse({
        kind: 'selection',
        bids: [
          {
            thread: { label: 'worker' },
            source: 'request',
            selected: true,
            type: 'event',
            detail: () => 'not json',
            priority: 0,
          },
        ],
      }),
    ).toThrow()
  })
})
