import { beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync, unlinkSync } from 'node:fs'
import { appendSnapshot, buildIndexes, readSnapshots, readSnapshotsIndexed } from '../snapshot.ts'

const cleanupTopic = (topicId: string) => {
  const paths = [
    `.plaited/snapshots/${topicId}.jsonl`,
    `.plaited/snapshots/${topicId}.kind.idx`,
    `.plaited/snapshots/${topicId}.time.idx`,
    `.plaited/snapshots/${topicId}.tar`,
  ]
  for (const path of paths) {
    try {
      unlinkSync(path)
    } catch {
      /* ignore */
    }
  }
}

describe('snapshot', () => {
  beforeEach(() => {
    cleanupTopic('topic-test')
  })

  test('appendSnapshot writes JSONL line', () => {
    appendSnapshot('topic-test', { kind: 'selection', step: 0, selected: { type: 'test' } })

    const content = readFileSync('.plaited/snapshots/topic-test.jsonl', 'utf8')
    const parsed = JSON.parse(content.trim())

    expect(parsed.kind).toBe('selection')
    expect(parsed.step).toBe(0)
  })

  test('readSnapshots returns parsed snapshots', async () => {
    appendSnapshot('topic-test', { kind: 'selection', step: 0, selected: { type: 'a' } })
    appendSnapshot('topic-test', { kind: 'deadlock', step: 1 })

    const snapshots = await readSnapshots('topic-test')

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]!.kind).toBe('selection')
    expect(snapshots[1]!.kind).toBe('deadlock')
  })

  test('readSnapshots filters by kind', async () => {
    appendSnapshot('topic-test', { kind: 'selection', step: 0, selected: { type: 'a' } })
    appendSnapshot('topic-test', { kind: 'deadlock', step: 1 })

    const filtered = await readSnapshots('topic-test', { kinds: ['selection'] })

    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.kind).toBe('selection')
  })

  test('readSnapshots applies limit', async () => {
    appendSnapshot('topic-test', { kind: 'selection', step: 0, selected: { type: 'a' } })
    appendSnapshot('topic-test', { kind: 'selection', step: 1, selected: { type: 'b' } })
    appendSnapshot('topic-test', { kind: 'selection', step: 2, selected: { type: 'c' } })

    const limited = await readSnapshots('topic-test', { limit: 2 })

    expect(limited).toHaveLength(2)
    expect(limited[0]!.kind).toBe('selection')
    expect(limited[1]!.kind).toBe('selection')
  })

  test('buildIndexes creates kind and time index files', async () => {
    appendSnapshot('topic-test', { kind: 'selection', step: 0, selected: { type: 'a' } })
    appendSnapshot('topic-test', { kind: 'deadlock', step: 1 })

    await buildIndexes('topic-test')

    const kindIdx = JSON.parse(readFileSync('.plaited/snapshots/topic-test.kind.idx', 'utf8'))
    expect(kindIdx).toHaveProperty('selection')
    expect(kindIdx).toHaveProperty('deadlock')
    expect(kindIdx.selection).toHaveLength(1)
  })

  test('readSnapshotsIndexed filters by kind using index', async () => {
    appendSnapshot('topic-test', { kind: 'selection', step: 0, selected: { type: 'a' } })
    appendSnapshot('topic-test', { kind: 'deadlock', step: 1 })
    appendSnapshot('topic-test', { kind: 'selection', step: 2, selected: { type: 'b' } })

    await buildIndexes('topic-test')

    const filtered = await readSnapshotsIndexed('topic-test', { kinds: ['selection'] })

    expect(filtered).toHaveLength(2)
    expect(filtered.every((s) => s.kind === 'selection')).toBe(true)
  })
})
