import { describe, expect, test } from 'bun:test'
import { bSync, bThread } from 'plaited/behavioral'
import * as z from 'zod'
import { replayToFrontier } from '../behavioral.frontier.ts'

const onType = (type: string) => ({
  type,
  sourceSchema: z.enum(['trigger', 'request', 'emit']),
  detailSchema: z.unknown(),
})

describe('replayToFrontier', () => {
  test('empty history reconstructs the initial frontier', () => {
    const { frontier, pending } = replayToFrontier({
      threads: {
        producer: bThread([bSync({ request: { type: 'task' } })]),
        consumer: bThread([bSync({ waitFor: onType('task') }), bSync({ request: { type: 'ack' } })]),
      },
      history: [],
    })

    expect([...pending.values()].map((bid) => bid.label)).toEqual(['producer', 'consumer'])
    expect(frontier.status).toBe('ready')
    expect(frontier.candidates.map((candidate) => candidate.type)).toEqual(['task'])
  })

  test('replaying one selected event advances affected threads and reconstructs the next frontier', () => {
    const { frontier, pending } = replayToFrontier({
      threads: {
        producer: bThread([bSync({ request: { type: 'task' } })]),
        consumer: bThread([bSync({ waitFor: onType('task') }), bSync({ request: { type: 'ack' } })]),
        interrupted: bThread([bSync({ interrupt: onType('task') }), bSync({ request: { type: 'should_not_happen' } })]),
      },
      history: [{ type: 'task', source: 'request' }],
    })

    expect([...pending.values()].map((bid) => bid.label)).toEqual(['consumer'])
    expect(frontier.status).toBe('ready')
    expect(frontier.candidates.map((candidate) => candidate.type)).toEqual(['ack'])
    expect(frontier.enabled.map((candidate) => candidate.type)).toEqual(['ack'])
  })

  test('replayed deadlock state is classified as deadlock', () => {
    const { frontier } = replayToFrontier({
      threads: {
        blocker: bThread([bSync({ block: onType('dangerous') })]),
        producer: bThread([bSync({ request: { type: 'dangerous' } })]),
      },
      history: [],
    })

    expect(frontier.status).toBe('deadlock')
    expect(frontier.candidates.map((candidate) => candidate.type)).toEqual(['dangerous'])
    expect(frontier.enabled).toHaveLength(0)
  })

  test('replayed ready state is classified as ready', () => {
    const { frontier } = replayToFrontier({
      threads: {
        producer: bThread([bSync({ request: { type: 'ping' } })]),
      },
      history: [],
    })

    expect(frontier.status).toBe('ready')
    expect(frontier.candidates.map((candidate) => candidate.type)).toEqual(['ping'])
    expect(frontier.enabled.map((candidate) => candidate.type)).toEqual(['ping'])
  })

  test('replayed idle state is classified as idle', () => {
    const { frontier } = replayToFrontier({
      threads: {
        watcher: bThread([bSync({ waitFor: onType('ping') })]),
      },
      history: [],
    })

    expect(frontier.status).toBe('idle')
    expect(frontier.candidates).toHaveLength(0)
    expect(frontier.enabled).toHaveLength(0)
  })

  test('replay uses event source provenance for match listeners', () => {
    const threads = {
      consumer: bThread([
        bSync({
          waitFor: {
            type: 'task',
            sourceSchema: z.literal('trigger'),
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        bSync({ request: { type: 'ack' } }),
      ]),
    }

    const triggerSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'trigger', detail: { id: 'job-1' } }],
    })
    expect(triggerSourceResult.frontier.enabled.map((candidate) => candidate.type)).toEqual(['ack'])

    const requestSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'request', detail: { id: 'job-1' } }],
    })
    expect(requestSourceResult.frontier.status).toBe('idle')
    expect(requestSourceResult.frontier.enabled).toHaveLength(0)
  })

  test('replay uses emit source provenance for match listeners', () => {
    const threads = {
      consumer: bThread([
        bSync({
          waitFor: {
            type: 'task',
            sourceSchema: z.literal('emit'),
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        bSync({ request: { type: 'ack' } }),
      ]),
    }

    const emitSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'emit', detail: { id: 'job-1' } }],
    })
    expect(emitSourceResult.frontier.enabled.map((candidate) => candidate.type)).toEqual(['ack'])

    const triggerSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'trigger', detail: { id: 'job-1' } }],
    })
    expect(triggerSourceResult.frontier.status).toBe('idle')
    expect(triggerSourceResult.frontier.enabled).toHaveLength(0)
  })

  test('replay matches request detail structurally when object key insertion order differs', () => {
    const replayDetail: Record<string, number> = {}
    replayDetail.b = 2
    replayDetail.a = 1

    const { frontier } = replayToFrontier({
      threads: {
        producer: bThread([
          bSync({ request: { type: 'task', detail: { a: 1, b: 2 } } }),
          bSync({ request: { type: 'after_task' } }),
        ]),
      },
      history: [{ type: 'task', source: 'request', detail: replayDetail }],
    })

    expect(frontier.status).toBe('ready')
    expect(frontier.enabled.map((candidate) => candidate.type)).toEqual(['after_task'])
  })
})
