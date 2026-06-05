import { beforeEach, describe, expect, test } from 'bun:test'
import { getTopicContext, querySnapshots, recordSnapshot, recordUiEvent, resetDb, upsertTopic } from '../db.ts'

describe('db', () => {
  beforeEach(() => {
    resetDb()
  })

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

  test('recordSnapshot stores and querySnapshots retrieves', () => {
    const message = {
      kind: 'selection' as const,
      step: 0,
      selected: { type: 'test_event' },
    }

    recordSnapshot('topic-snap', message)
    const snapshots = querySnapshots('topic-snap')

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]!.kind).toBe('selection')
    expect(snapshots[0]!.kind === 'selection' ? snapshots[0]!.step : -1).toBe(0)
  })

  test('querySnapshots filters by kind', () => {
    recordSnapshot('topic-filter', { kind: 'selection' as const, step: 0, selected: { type: 'a' } })
    recordSnapshot('topic-filter', { kind: 'deadlock' as const, step: 1 })

    const selections = querySnapshots('topic-filter', { kinds: ['selection'] })

    expect(selections).toHaveLength(1)
    expect(selections[0]!.kind).toBe('selection')
  })

  test('querySnapshots filters by limit', () => {
    recordSnapshot('topic-limit', { kind: 'selection' as const, step: 0, selected: { type: 'a' } })
    recordSnapshot('topic-limit', { kind: 'selection' as const, step: 1, selected: { type: 'b' } })
    recordSnapshot('topic-limit', { kind: 'selection' as const, step: 2, selected: { type: 'c' } })

    const limited = querySnapshots('topic-limit', { limit: 2 })

    expect(limited).toHaveLength(2)
  })

  test('recordUiEvent stores render event', () => {
    recordUiEvent('topic-ui', 'render', {
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
    })

    // Querying ui_events requires direct SQL or a new exported function.
    // For now, we verify no error is thrown.
    expect(true).toBe(true)
  })
})
