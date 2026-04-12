import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { bSync, bThread } from '../../behavioral.ts'
import { getDeclaredModuleName, useModule } from '../use-module.ts'

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

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      last: () => undefined,
      addThreads: () => {},
      useSnapshot: () => () => {},
    })

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

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      last: () => undefined,
      addThreads: () => {},
      useSnapshot: () => () => {},
    })

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

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      last: () => undefined,
      addThreads: () => {},
      useSnapshot: () => () => {},
    })

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

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      last: () => undefined,
      addThreads: () => {},
      useSnapshot: () => () => {},
    })

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
      moduleId: 'bootstrap#4',
      emit: () => {},
      last: () => undefined,
      addThreads: () => {},
      useSnapshot: () => () => {},
    })

    expect(localType).toBe('bootstrap#4:tick')
  })

  test('exposes bSync and bThread helpers to module callbacks', () => {
    let hasBSync = false
    let hasBThread = false

    const module = useModule('memory', ({ bSync: moduleBSync, bThread: moduleBThread }) => {
      hasBSync = moduleBSync === bSync
      hasBThread = moduleBThread === bThread
      return {}
    })

    module({
      moduleId: 'bootstrap#0',
      emit: () => {},
      last: () => undefined,
      addThreads: () => {},
      useSnapshot: () => () => {},
    })

    expect(hasBSync).toBe(true)
    expect(hasBThread).toBe(true)
  })

  test('attaches declared module name metadata for duplicate detection', () => {
    const module = useModule('memory', () => ({}))
    expect(getDeclaredModuleName(module)).toBe('memory')
  })
})
