import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { replayToFrontier } from '../../cli/behavioral-frontier/behavioral-frontier.ts'
import { sync, thread } from './helpers.ts'

const onType = (type: string) => ({
  type,
})

describe('replayToFrontier', () => {
  test('empty history reconstructs the initial frontier', () => {
    const { frontier, pending } = replayToFrontier({
      threads: {
        producer: thread([sync({ request: { type: 'task' } })], true),
        consumer: thread([sync({ waitFor: onType('task') }), sync({ request: { type: 'ack' } })], true),
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
        producer: thread([sync({ request: { type: 'task' } })], true),
        consumer: thread([sync({ waitFor: onType('task') }), sync({ request: { type: 'ack' } })], true),
        interrupted: thread(
          [sync({ interrupt: onType('task') }), sync({ request: { type: 'should_not_happen' } })],
          true,
        ),
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
        blocker: thread([sync({ block: onType('dangerous') })], true),
        producer: thread([sync({ request: { type: 'dangerous' } })], true),
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
        producer: thread([sync({ request: { type: 'ping' } })], true),
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
        watcher: thread([sync({ waitFor: onType('ping') })], true),
      },
      history: [],
    })

    expect(frontier.status).toBe('idle')
    expect(frontier.candidates).toHaveLength(0)
    expect(frontier.enabled).toHaveLength(0)
  })

  test('replay uses event source provenance for match listeners', () => {
    const threads = {
      consumer: thread(
        [
          sync({
            waitFor: {
              type: 'task',
              source: 'trigger',
              detailSchema: z.object({ id: z.string() }),
            },
          }),
          sync({ request: { type: 'ack' } }),
        ],
        true,
      ),
    }

    const triggerSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'trigger', detail: { id: 'job-1' } }],
    })
    expect(triggerSourceResult.frontier.enabled.map((candidate) => candidate.type)).toEqual(['ack'])

    expect(() =>
      replayToFrontier({
        threads: {
          consumer: threads.consumer,
        },
        history: [{ type: 'task', source: 'request', detail: { id: 'job-1' } }],
      }),
    ).toThrowError(/invalid request history event "task"/)
  })

  test('replay uses request source provenance for match listeners', () => {
    const threads = {
      producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true),
      consumer: thread(
        [
          sync({
            waitFor: {
              type: 'task',
              source: 'request',
              detailSchema: z.object({ id: z.string() }),
            },
          }),
          sync({ request: { type: 'ack' } }),
        ],
        true,
      ),
    }

    const requestSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'request', detail: { id: 'job-1' } }],
    })
    expect(requestSourceResult.frontier.enabled.map((candidate) => candidate.type)).toEqual(['ack'])

    const triggerSourceResult = replayToFrontier({
      threads,
      history: [{ type: 'task', source: 'trigger', detail: { id: 'job-1' } }],
    })
    expect(triggerSourceResult.frontier.enabled.map((candidate) => candidate.type)).toEqual(['task'])
  })

  test('replay matches request detail structurally when object key insertion order differs', () => {
    const replayDetail: Record<string, number> = {}
    replayDetail.b = 2
    replayDetail.a = 1

    const { frontier } = replayToFrontier({
      threads: {
        producer: thread(
          [sync({ request: { type: 'task', detail: { a: 1, b: 2 } } }), sync({ request: { type: 'after_task' } })],
          true,
        ),
      },
      history: [{ type: 'task', source: 'request', detail: replayDetail }],
    })

    expect(frontier.status).toBe('ready')
    expect(frontier.enabled.map((candidate) => candidate.type)).toEqual(['after_task'])
  })

  test('throws when request history includes an event that is not enabled at that step', () => {
    expect(() =>
      replayToFrontier({
        threads: {
          producer: thread([sync({ request: { type: 'task' } })], true),
        },
        history: [{ type: 'missing_task', source: 'request' }],
      }),
    ).toThrowError(/invalid request history event "missing_task"/)
  })
})
