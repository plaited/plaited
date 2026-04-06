import { describe, expect, test } from 'bun:test'
import { bSyncReplaySafe, bThreadReplaySafe } from 'plaited/behavioral'
import * as z from 'zod'
import { replayToFrontier } from '../replay-to-frontier.ts'

describe('replayToFrontier', () => {
  test('empty history reconstructs the initial frontier', () => {
    const { frontier, pending } = replayToFrontier({
      threads: {
        producer: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'task' } })]),
        consumer: bThreadReplaySafe([
          bSyncReplaySafe({ waitFor: 'task' }),
          bSyncReplaySafe({ request: { type: 'ack' } }),
        ]),
      },
      history: [],
    })

    expect([...pending.keys()]).toEqual(['producer', 'consumer'])
    expect(frontier.status).toBe('ready')
    expect(frontier.candidates.map((candidate) => candidate.type)).toEqual(['task'])
  })

  test('replaying one selected event advances affected threads and reconstructs the next frontier', () => {
    const { frontier, pending } = replayToFrontier({
      threads: {
        producer: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'task' } })]),
        consumer: bThreadReplaySafe([
          bSyncReplaySafe({ waitFor: 'task' }),
          bSyncReplaySafe({ request: { type: 'ack' } }),
        ]),
        interrupted: bThreadReplaySafe([
          bSyncReplaySafe({ interrupt: 'task' }),
          bSyncReplaySafe({ request: { type: 'should_not_happen' } }),
        ]),
      },
      history: [{ type: 'task' }],
    })

    expect([...pending.keys()]).toEqual(['consumer'])
    expect(frontier.status).toBe('ready')
    expect(frontier.candidates.map((candidate) => candidate.type)).toEqual(['ack'])
    expect(frontier.enabled.map((candidate) => candidate.type)).toEqual(['ack'])
  })

  test('replayed deadlock state is classified as deadlock', () => {
    const { frontier } = replayToFrontier({
      threads: {
        blocker: bThreadReplaySafe([bSyncReplaySafe({ block: 'dangerous' })]),
        producer: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'dangerous' } })]),
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
        producer: bThreadReplaySafe([bSyncReplaySafe({ request: { type: 'ping' } })]),
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
        watcher: bThreadReplaySafe([bSyncReplaySafe({ waitFor: 'ping' })]),
      },
      history: [],
    })

    expect(frontier.status).toBe('idle')
    expect(frontier.candidates).toHaveLength(0)
    expect(frontier.enabled).toHaveLength(0)
  })

  test('replay uses event source provenance for match listeners', () => {
    const threads = {
      consumer: bThreadReplaySafe([
        bSyncReplaySafe({
          waitFor: {
            kind: 'match',
            type: 'task',
            sourceSchema: z.literal('trigger'),
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        bSyncReplaySafe({ request: { type: 'ack' } }),
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
})
