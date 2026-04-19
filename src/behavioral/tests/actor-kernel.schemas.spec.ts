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
})
