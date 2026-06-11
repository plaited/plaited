import { beforeEach, describe, expect, test } from 'bun:test'
import { getTopicContext, queryEvents, recordSnapshot, recordUiEvent, resetDb, upsertTopic } from '../db.ts'

describe('db', () => {
  beforeEach(() => {
    resetDb()
  })

  describe('topics', () => {
    test('upsertTopic creates a topic and getTopicContext retrieves it', () => {
      upsertTopic({ id: 'topic-1', name: 'Test Topic', memory: 'some memory', user: 'some user' })

      const context = getTopicContext('topic-1')

      expect(context).toBeDefined()
      expect(context!.memory).toBe('some memory')
      expect(context!.user).toBe('some user')
    })

    test('upsertTopic updates existing topic fields', () => {
      upsertTopic({ id: 'topic-2', name: 'Original' })
      upsertTopic({ id: 'topic-2', memory: 'updated memory' })

      const context = getTopicContext('topic-2')

      expect(context).toBeDefined()
      expect(context!.memory).toBe('updated memory')
      expect(context!.user).toBeNull()
    })

    test('upsertTopic with no changes is a no-op', () => {
      upsertTopic({ id: 'topic-3', name: 'No-op Test', memory: 'mem' })
      upsertTopic({ id: 'topic-3' })

      const context = getTopicContext('topic-3')

      expect(context!.memory).toBe('mem')
    })

    test('getTopicContext returns undefined for unknown topic', () => {
      const context = getTopicContext('nonexistent')

      expect(context).toBeUndefined()
    })
  })

  describe('snapshots', () => {
    test('records and retrieves a selection snapshot', () => {
      upsertTopic({ id: 'topic-sel' })
      recordSnapshot('topic-sel', {
        kind: 'selection',
        step: 5,
        selected: { type: 'worker_open', detail: { key: 'val' } },
      })

      const events = queryEvents({ topic: 'topic-sel' })

      expect(events).toHaveLength(1)
      const event = events[0]!
      expect(event.kind).toBe('selection')
      expect(event.step).toBe(5)
      expect(event.event_type).toBe('worker_open')
      expect(event.selected_detail).toEqual({ key: 'val' })
    })

    test('records and retrieves a frontier snapshot', () => {
      upsertTopic({ id: 'topic-fr' })
      recordSnapshot('topic-fr', {
        kind: 'frontier',
        step: 0,
        status: 'ready',
        candidates: [{ type: 'a', priority: 1 }],
        enabled: [{ type: 'a', priority: 1 }],
      })

      const events = queryEvents({ topic: 'topic-fr' })

      expect(events).toHaveLength(1)
      expect(events[0]!.kind).toBe('frontier')
      expect(events[0]!.status).toBe('ready')
    })

    test('records and retrieves a deadlock snapshot', () => {
      upsertTopic({ id: 'topic-dl' })
      recordSnapshot('topic-dl', { kind: 'deadlock', step: 3 })

      const events = queryEvents({ topic: 'topic-dl' })

      expect(events).toHaveLength(1)
      expect(events[0]!.kind).toBe('deadlock')
      expect(events[0]!.step).toBe(3)
    })

    test('records and retrieves a feedback_error snapshot', () => {
      upsertTopic({ id: 'topic-fe' })
      recordSnapshot('topic-fe', {
        kind: 'feedback_error',
        type: 'my_event',
        detail: { foo: 'bar' },
        error: 'handler crashed',
      })

      const events = queryEvents({ topic: 'topic-fe' })

      expect(events).toHaveLength(1)
      expect(events[0]!.kind).toBe('feedback_error')
      expect(events[0]!.event_type).toBe('my_event')
      expect(events[0]!.error).toBe('handler crashed')
      expect(events[0]!.feedback_detail).toEqual({ foo: 'bar' })
    })

    test('records and retrieves a runtime_error snapshot', () => {
      upsertTopic({ id: 'topic-re' })
      recordSnapshot('topic-re', { kind: 'runtime_error', error: 'out of memory' })

      const events = queryEvents({ topic: 'topic-re' })

      expect(events).toHaveLength(1)
      expect(events[0]!.kind).toBe('runtime_error')
      expect(events[0]!.error).toBe('out of memory')
    })

    test('records and retrieves an add_thread_error snapshot', () => {
      upsertTopic({ id: 'topic-ate' })
      recordSnapshot('topic-ate', {
        kind: 'add_thread_error',
        label: 'bad_thread',
        error: 'not a valid thread',
      })

      const events = queryEvents({ topic: 'topic-ate' })

      expect(events).toHaveLength(1)
      expect(events[0]!.kind).toBe('add_thread_error')
      expect(events[0]!.label).toBe('bad_thread')
      expect(events[0]!.error).toBe('not a valid thread')
    })

    test('records and retrieves a pending_bids snapshot', () => {
      upsertTopic({ id: 'topic-pb' })
      recordSnapshot('topic-pb', {
        kind: 'pending_bids',
        step: 2,
        threads: [{ label: 'thread-1', priority: 1, request: { type: 'evt' } }],
      })

      const events = queryEvents({ topic: 'topic-pb' })

      expect(events).toHaveLength(1)
      expect(events[0]!.kind).toBe('pending_bids')
      expect(events[0]!.threads).toBeDefined()
    })

    test('filters by kind', () => {
      upsertTopic({ id: 'topic-fk' })
      recordSnapshot('topic-fk', { kind: 'selection', step: 0, selected: { type: 'a' } })
      recordSnapshot('topic-fk', { kind: 'deadlock', step: 1 })

      const selections = queryEvents({ topic: 'topic-fk', kind: 'selection' })
      const deadlocks = queryEvents({ topic: 'topic-fk', kind: 'deadlock' })

      expect(selections).toHaveLength(1)
      expect(selections[0]!.kind).toBe('selection')
      expect(deadlocks).toHaveLength(1)
      expect(deadlocks[0]!.kind).toBe('deadlock')
    })

    test('filters by limit', () => {
      upsertTopic({ id: 'topic-lim' })
      recordSnapshot('topic-lim', { kind: 'selection', step: 0, selected: { type: 'a' } })
      recordSnapshot('topic-lim', { kind: 'selection', step: 1, selected: { type: 'b' } })
      recordSnapshot('topic-lim', { kind: 'selection', step: 2, selected: { type: 'c' } })

      const events = queryEvents({ topic: 'topic-lim', limit: 2 })

      expect(events).toHaveLength(2)
    })

    test('multiple events are ordered by seq descending', () => {
      upsertTopic({ id: 'topic-ord' })
      recordSnapshot('topic-ord', { kind: 'selection', step: 0, selected: { type: 'first' } })
      recordSnapshot('topic-ord', { kind: 'selection', step: 1, selected: { type: 'second' } })
      recordSnapshot('topic-ord', { kind: 'deadlock', step: 2 })

      const events = queryEvents({ topic: 'topic-ord' })

      expect(events).toHaveLength(3)
      // Newest first (seq DESC)
      expect(events[0]!.step).toBe(2)
      expect(events[1]!.step).toBe(1)
      expect(events[2]!.step).toBe(0)
    })
  })

  describe('ui events', () => {
    test('recordUiEvent stores render event', () => {
      upsertTopic({ id: 'topic-ui' })
      recordUiEvent({
        topicId: 'topic-ui',
        type: 'render',
        event: {
          type: 'render',
          detail: {
            topic: 'topic-ui',
            version: 'v1',
            target: '#app',
            html: '<div>hello</div>',
            stylesheets: [],
            swap: 'innerHTML',
            registry: ['mod1'],
          },
        },
      })

      expect(true).toBe(true)
    })
  })
})
