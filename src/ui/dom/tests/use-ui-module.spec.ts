import { describe, expect, test } from 'bun:test'
import * as z from 'zod'

import { bSync, bThread } from '../../../behavioral.ts'
import { useUIModule } from '../use-ui-module.ts'

const createInstallParams = () => ({
  moduleId: 'update_behavioral#0',
  emit: () => {},
  addThreads: () => {},
  useSnapshot: () => () => {},
})

describe('useUIModule', () => {
  test('declares explicit action interest and auto-prefixes local handlers', () => {
    const ActionSchema = z.object({
      type: z.literal('test_click'),
      detail: z.unknown(),
    })
    const LocalSchema = z.object({
      type: z.literal('apply_click'),
      detail: z.undefined(),
    })

    const module = useUIModule('behavioral_fixture', ({ action, local, bSync, bThread }) => {
      const userAction = action(ActionSchema)
      const applyClick = local(LocalSchema)
      return {
        threads: {
          onAction: bThread([
            bSync({
              waitFor: userAction.on(z.literal('trigger')),
            }),
            bSync({
              request: applyClick.request(),
            }),
          ]),
        },
        handlers: {
          apply_click() {},
        },
      }
    })

    const result = module(createInstallParams())
    expect(result.actions).toEqual(['test_click'])
    expect(Object.keys(result.handlers ?? {})).toEqual(['behavioral_fixture:apply_click'])
    expect(Object.keys(result.threads ?? {})).toEqual(['behavioral_fixture:onAction'])
  })

  test('rejects handler keys outside local module scope', () => {
    const module = useUIModule('planner', () => ({
      handlers: {
        'retriever:ready'() {},
      },
    }))

    expect(() => module(createInstallParams())).toThrowError(/handlers cannot target "retriever:ready"/)
  })

  test('rejects duplicate normalized handler keys', () => {
    const module = useUIModule('planner', () => ({
      handlers: {
        ready() {},
        'planner:ready'() {},
      },
    }))

    expect(() => module(createInstallParams())).toThrowError(/duplicate key "planner:ready"/)
  })

  test('wrapped emit only accepts event refs authored through useUIModule helpers', () => {
    const SharedSchema = z.object({
      type: z.literal('shared'),
      detail: z.object({ ok: z.boolean() }),
    })
    const seen: Array<{ type: string; detail?: unknown }> = []
    const valid = useUIModule('planner', ({ external, emit }) => {
      emit(external(SharedSchema).request({ ok: true }))
      return {}
    })

    expect(() =>
      valid({
        ...createInstallParams(),
        emit: (event) => seen.push(event),
      }),
    ).not.toThrow()
    expect(seen).toEqual([{ type: 'shared', detail: { ok: true } }])

    const invalid = useUIModule('planner', ({ emit }) => {
      emit({ type: 'raw' })
      return {}
    })
    expect(() => invalid(createInstallParams())).toThrowError(/emit\(event\).*requires UI module event refs/)
  })

  test('wrapped bThread/addThreads reject canonical imported rules', () => {
    const rejectsBThread = useUIModule('planner', ({ bThread: moduleBThread }) => {
      moduleBThread([bSync({ request: { type: 'raw' } })])
      return {}
    })
    expect(() => rejectsBThread(createInstallParams())).toThrowError(/bThread\(rules\[0\]\)/)

    const rejectsAddThreads = useUIModule('planner', ({ addThreads }) => {
      addThreads({
        guard: bThread([bSync({ request: { type: 'raw' } })]),
      })
      return {}
    })
    expect(() => rejectsAddThreads(createInstallParams())).toThrowError(/addThreads\(threads\)\["guard"\]/)
  })
})
