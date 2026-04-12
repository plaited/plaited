import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { getDeclaredModuleName, useModule } from '../use-module.ts'

describe('useModule', () => {
  test('local(listener) prefixes listener types with the declared module name', () => {
    let localType = ''

    const module = useModule('memory', ({ local }) => {
      localType = local({
        type: 'tick',
        sourceSchema: z.enum(['trigger', 'request', 'emit']),
        detailSchema: z.unknown(),
      }).type
      return {}
    })

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      useSnapshot: () => () => {},
      memory: { get: () => undefined },
    })

    expect(localType).toBe('memory:tick')
  })

  test('external(listener) returns the original listener unchanged', () => {
    let externalType = ''
    const listener = {
      type: 'shared_event',
      sourceSchema: z.enum(['trigger', 'request', 'emit']),
      detailSchema: z.unknown(),
    }

    const module = useModule('memory', ({ external }) => {
      externalType = external(listener).type
      return {}
    })

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      useSnapshot: () => () => {},
      memory: { get: () => undefined },
    })

    expect(externalType).toBe('shared_event')
  })

  test('attaches declared module name metadata for duplicate detection', () => {
    const module = useModule('memory', () => ({}))
    expect(getDeclaredModuleName(module)).toBe('memory')
  })
})
