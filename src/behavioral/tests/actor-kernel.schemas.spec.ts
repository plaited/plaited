import { describe, expect, test } from 'bun:test'
import * as z from 'zod'

import { ActorEnvelopeSchema, ActorRefSchema } from '../behavioral.schemas.ts'

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
  test('ActorRefSchema exports JSON Schema with id and kind as required fields', () => {
    const schema = z.toJSONSchema(ActorRefSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['id', 'kind']))
    expect(required).toHaveLength(2)

    const kindSchema = (schema as JsonSchemaShape).properties?.kind as { enum?: unknown } | undefined
    expect(Array.isArray(kindSchema?.enum)).toBe(true)
    expect(kindSchema?.enum).toContain('projection')
  })

  test('ActorEnvelopeSchema exports JSON Schema with id, type, and source as required fields', () => {
    const schema = z.toJSONSchema(ActorEnvelopeSchema)
    const required = readRequired(schema)

    expect(required).toEqual(expect.arrayContaining(['id', 'type', 'source']))
    expect(required).toHaveLength(3)
  })

  test('ActorEnvelopeSchema accepts nested JSON detail object values', () => {
    const parsed = ActorEnvelopeSchema.parse({
      id: 'env-1',
      type: 'test_event',
      source: { id: 'source-1', kind: 'module' },
      detail: {
        nested: {
          ok: true,
          count: 2,
          list: ['a', 1, null, { deep: 'value' }],
        },
      },
    })

    expect(parsed.detail?.nested).toBeDefined()
  })

  test('ActorEnvelopeSchema rejects non-JSON detail values like functions', () => {
    expect(() =>
      ActorEnvelopeSchema.parse({
        id: 'env-2',
        type: 'test_event',
        source: { id: 'source-1', kind: 'module' },
        detail: {
          fn: () => 'not json',
        },
      }),
    ).toThrow()
  })
})
