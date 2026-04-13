import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { bSync, bThread } from '../behavioral.utils.ts'
import { getDeclaredModuleName, useModule } from '../use-module.old.ts'

const createModuleParams = () => ({
  moduleId: 'bootstrap#0',
  emit: () => {},
  last: () => undefined,
  addThreads: () => {},
  useSnapshot: () => () => {},
})

describe('useModule', () => {
  test('local(schema) derives listener/request type from schema and prefixes with module scope', () => {
    let localType = ''
    let eventType = ''
    let requestedType = ''
    let requestedDetail: unknown
    const TaskEventSchema = z.object({
      type: z.literal('task'),
      detail: z.object({ id: z.string() }),
    })

    const module = useModule('memory', ({ local }) => {
      const task = local(TaskEventSchema)
      eventType = task.type
      localType = task.on(z.literal('trigger')).type
      const request = task.request({ id: 'job-1' })
      requestedType = request.type
      requestedDetail = request.detail
      return {}
    })

    module(createModuleParams())

    expect(eventType).toBe('memory:task')
    expect(localType).toBe('memory:task')
    expect(requestedType).toBe('memory:task')
    expect(requestedDetail).toEqual({ id: 'job-1' })
  })

  test('local(schema) supports detail-less schemas declared with z.undefined()', () => {
    let request: { type: string; detail?: unknown } | undefined
    const TickEventSchema = z.object({
      type: z.literal('tick'),
      detail: z.undefined(),
    })

    const module = useModule('memory', ({ local }) => {
      const tick = local(TickEventSchema)
      request = tick.request()
      return {}
    })

    module(createModuleParams())

    expect(request).toEqual({ type: 'memory:tick' })
  })

  test('external(schema) keeps the schema event type unchanged by default', () => {
    let externalType = ''
    let eventType = ''
    const SharedEventSchema = z.object({
      type: z.literal('shared_event'),
      detail: z.object({ ok: z.boolean() }),
    })

    const module = useModule('memory', ({ external }) => {
      const event = external(SharedEventSchema)
      eventType = event.type
      externalType = event.on().type
      return {}
    })

    module(createModuleParams())

    expect(eventType).toBe('shared_event')
    expect(externalType).toBe('shared_event')
  })

  test('external(schema, moduleName) prefixes with the provided module name', () => {
    let externalType = ''
    const ReadyEventSchema = z.object({
      type: z.literal('ready'),
      detail: z.object({ version: z.number() }),
    })

    const module = useModule('planner', ({ external }) => {
      externalType = external(ReadyEventSchema, 'retriever').on().type
      return {}
    })

    module(createModuleParams())

    expect(externalType).toBe('retriever:ready')
  })

  test('local(schema) falls back to moduleId scope when declared module name is empty', () => {
    let localType = ''
    const TickEventSchema = z.object({
      type: z.literal('tick'),
      detail: z.object({ n: z.number() }),
    })

    const module = useModule('  ', ({ local }) => {
      localType = local(TickEventSchema).on().type
      return {}
    })

    module({
      ...createModuleParams(),
      moduleId: 'bootstrap#4',
    })

    expect(localType).toBe('bootstrap#4:tick')
  })

  test('normalizes unprefixed handler keys to module scope', () => {
    const module = useModule('planner', () => ({
      handlers: {
        ready() {},
      },
    }))

    const result = module(createModuleParams())
    expect(Object.keys(result.handlers ?? {})).toEqual(['planner:ready'])
  })

  test('accepts already-local handler keys without double-prefixing', () => {
    const module = useModule('planner', () => ({
      handlers: {
        'planner:ready'() {},
      },
    }))

    const result = module(createModuleParams())
    expect(Object.keys(result.handlers ?? {})).toEqual(['planner:ready'])
  })

  test('accepts already-local handler keys when declared module name contains ":"', () => {
    const module = useModule('team:planner', () => ({
      handlers: {
        'team:planner:ready'() {},
      },
    }))

    const result = module(createModuleParams())
    expect(Object.keys(result.handlers ?? {})).toEqual(['team:planner:ready'])
  })

  test('treats unprefixed shared-looking handler keys as local by default', () => {
    const module = useModule('planner', () => ({
      handlers: {
        fixture_ping() {},
      },
    }))

    const result = module(createModuleParams())
    expect(Object.keys(result.handlers ?? {})).toEqual(['planner:fixture_ping'])
  })

  test('rejects handler keys prefixed with a different module scope', () => {
    const module = useModule('planner', () => ({
      handlers: {
        'retriever:ready'() {},
      },
    }))

    expect(() => module(createModuleParams())).toThrowError(
      /handlers cannot target "retriever:ready".*waitFor external\(schema\[, moduleName\]\)\.on\(\.\.\.\).*request local\(schema\)\.request\(\.\.\.\)/,
    )
  })

  test('rejects duplicate normalized handler keys', () => {
    const module = useModule('planner', () => ({
      handlers: {
        ready() {},
        'planner:ready'() {},
      },
    }))

    expect(() => module(createModuleParams())).toThrowError(/duplicate key "planner:ready"/)
  })

  test('wrapped bSync accepts module event refs for waitFor/block/interrupt/request', () => {
    const KickoffEventSchema = z.object({
      type: z.literal('kickoff'),
      detail: z.undefined(),
    })
    const SharedEventSchema = z.object({
      type: z.literal('shared'),
      detail: z.object({ ok: z.boolean() }),
    })
    const module = useModule('planner', ({ local, external, bSync }) => {
      const kickoff = local(KickoffEventSchema)
      const shared = external(SharedEventSchema)
      const ready = external(SharedEventSchema, 'retriever')

      bSync({ waitFor: kickoff.on(z.literal('trigger')) })
      bSync({ block: shared.on() })
      bSync({ interrupt: [kickoff.on(), ready.on()] })
      bSync({ request: kickoff.request() })
      bSync({ request: shared.request({ ok: true }) })
      return {}
    })

    expect(() => module(createModuleParams())).not.toThrow()
  })

  test('wrapped bSync rejects raw waitFor listeners', () => {
    const module = useModule('planner', ({ bSync }) => {
      bSync({
        waitFor: {
          type: 'raw_wait',
          sourceSchema: z.literal('trigger'),
          detailSchema: z.unknown(),
        },
      })
      return {}
    })

    expect(() => module(createModuleParams())).toThrowError(
      /waitFor.*local\(schema\)\.on\(\.\.\.\) or external\(schema\[, moduleName\]\)\.on\(\.\.\.\)/,
    )
  })

  test('wrapped bSync rejects raw block listeners', () => {
    const module = useModule('planner', ({ bSync }) => {
      bSync({
        block: {
          type: 'raw_block',
          sourceSchema: z.literal('trigger'),
          detailSchema: z.unknown(),
        },
      })
      return {}
    })

    expect(() => module(createModuleParams())).toThrowError(
      /block.*local\(schema\)\.on\(\.\.\.\) or external\(schema\[, moduleName\]\)\.on\(\.\.\.\)/,
    )
  })

  test('wrapped bSync rejects raw interrupt listeners in arrays', () => {
    const KickoffEventSchema = z.object({
      type: z.literal('kickoff'),
      detail: z.undefined(),
    })
    const module = useModule('planner', ({ local, bSync }) => {
      const kickoff = local(KickoffEventSchema)
      bSync({
        interrupt: [
          kickoff.on(),
          {
            type: 'raw_interrupt',
            sourceSchema: z.literal('trigger'),
            detailSchema: z.unknown(),
          },
        ],
      })
      return {}
    })

    expect(() => module(createModuleParams())).toThrowError(
      /interrupt.*local\(schema\)\.on\(\.\.\.\) or external\(schema\[, moduleName\]\)\.on\(\.\.\.\)/,
    )
  })

  test('wrapped bSync rejects raw request events', () => {
    const module = useModule('planner', ({ bSync }) => {
      bSync({
        request: {
          type: 'raw_request',
        },
      })
      return {}
    })

    expect(() => module(createModuleParams())).toThrowError(
      /request.*local\(schema\)\.request\(\.\.\.\) or external\(schema\[, moduleName\]\)\.request\(\.\.\.\)/,
    )
  })

  test('wrapped emit accepts module request refs and rejects raw events', () => {
    const SharedEventSchema = z.object({
      type: z.literal('shared'),
      detail: z.object({ ok: z.boolean() }),
    })
    const seen: Array<{ type: string; detail?: unknown }> = []
    const valid = useModule('planner', ({ external, emit }) => {
      const shared = external(SharedEventSchema)
      emit(shared.request({ ok: true }))
      return {}
    })

    expect(() =>
      valid({
        ...createModuleParams(),
        emit: (event) => seen.push(event),
      }),
    ).not.toThrow()
    expect(seen).toEqual([{ type: 'shared', detail: { ok: true } }])

    const invalid = useModule('planner', ({ emit }) => {
      emit({ type: 'raw' })
      return {}
    })
    expect(() => invalid(createModuleParams())).toThrowError(
      /emit\(event\).*local\(schema\)\.request\(\.\.\.\) or external\(schema\[, moduleName\]\)\.request\(\.\.\.\)/,
    )
  })

  test('wrapped last accepts module listeners and rejects raw listeners', () => {
    const SharedEventSchema = z.object({
      type: z.literal('shared'),
      detail: z.object({ ok: z.boolean() }),
    })
    let seenType = ''
    const valid = useModule('planner', ({ external, last }) => {
      const shared = external(SharedEventSchema)
      last(shared.on())
      return {}
    })
    expect(() =>
      valid({
        ...createModuleParams(),
        last: (listener) => {
          seenType = listener.type
          return undefined
        },
      }),
    ).not.toThrow()
    expect(seenType).toBe('shared')

    const invalid = useModule('planner', ({ last }) => {
      last({
        type: 'raw',
        sourceSchema: z.literal('trigger'),
        detailSchema: z.unknown(),
      })
      return {}
    })
    expect(() => invalid(createModuleParams())).toThrowError(
      /last\(listener\).*local\(schema\)\.on\(\.\.\.\) or external\(schema\[, moduleName\]\)\.on\(\.\.\.\)/,
    )
  })

  test('wrapped bThread rejects rules created by canonical imported bSync', () => {
    const module = useModule('planner', ({ bThread: moduleBThread }) => {
      moduleBThread([bSync({ request: { type: 'raw' } })])
      return {}
    })

    expect(() => module(createModuleParams())).toThrowError(
      /bThread\(rules\[0\]\).*bSync and bThread helpers from useModule callback args/,
    )
  })

  test('wrapped addThreads rejects canonical imported bThread rules', () => {
    const module = useModule('planner', ({ addThreads }) => {
      addThreads({
        guard: bThread([bSync({ request: { type: 'raw' } })]),
      })
      return {}
    })

    expect(() => module(createModuleParams())).toThrowError(
      /addThreads\(threads\)\["guard"\].*bSync and bThread helpers from useModule callback args/,
    )
  })

  test('exposes wrapped bSync and wrapped bThread helpers to module callbacks', () => {
    let hasBSync = false
    let hasBThread = false

    const module = useModule('memory', ({ bSync: moduleBSync, bThread: moduleBThread }) => {
      hasBSync = moduleBSync === bSync
      hasBThread = moduleBThread === bThread
      return {}
    })

    module(createModuleParams())

    expect(hasBSync).toBe(false)
    expect(hasBThread).toBe(false)
  })

  test('attaches declared module name metadata for duplicate detection', () => {
    const module = useModule('memory', () => ({}))
    expect(getDeclaredModuleName(module)).toBe('memory')
  })
})
