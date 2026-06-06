import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { SnapshotMessage } from '../behavioral.ts'

const SNAPSHOTS_DIR = '.plaited/snapshots'

const getSnapshotPath = (topicId: string) => resolve(process.cwd(), SNAPSHOTS_DIR, `${topicId}.jsonl`)

const ensureSnapshotsDir = () => mkdirSync(resolve(process.cwd(), SNAPSHOTS_DIR), { recursive: true })

export const appendSnapshot = (topicId: string, message: SnapshotMessage) => {
  ensureSnapshotsDir()
  const line = `${JSON.stringify(message)}\n`
  appendFileSync(getSnapshotPath(topicId), line)
}

export const readSnapshots = async (
  topicId: string,
  {
    kinds,
    limit,
  }: {
    kinds?: Array<SnapshotMessage['kind']>
    limit?: number
  } = {},
): Promise<SnapshotMessage[]> => {
  const file = Bun.file(getSnapshotPath(topicId))
  if (!(await file.exists())) return []

  const text = await file.text()
  const lines = text.split('\n').filter(Boolean)

  let snapshots = lines.map((line) => JSON.parse(line) as SnapshotMessage)

  if (kinds !== undefined && kinds.length > 0) {
    snapshots = snapshots.filter((s) => kinds.includes(s.kind))
  }

  if (limit !== undefined && limit > 0) {
    snapshots = snapshots.slice(-limit)
  }

  return snapshots
}

type KindIndex = Record<string, number[]>

type TimeIndex = Array<{ ts: number; offset: number }>

const getIndexPaths = (topicId: string) => ({
  kind: resolve(process.cwd(), SNAPSHOTS_DIR, `${topicId}.kind.idx`),
  time: resolve(process.cwd(), SNAPSHOTS_DIR, `${topicId}.time.idx`),
})

const readKindIndex = async (path: string): Promise<KindIndex> => {
  const file = Bun.file(path)
  if (!(await file.exists())) return {}
  try {
    return (await file.json()) as KindIndex
  } catch {
    return {}
  }
}

const readTimeIndex = async (path: string): Promise<TimeIndex> => {
  const file = Bun.file(path)
  if (!(await file.exists())) return []
  try {
    return (await file.json()) as TimeIndex
  } catch {
    return []
  }
}

const writeKindIndex = (path: string, index: KindIndex) => {
  Bun.write(path, JSON.stringify(index))
}

const writeTimeIndex = (path: string, index: TimeIndex) => {
  Bun.write(path, JSON.stringify(index))
}

export const buildIndexes = async (topicId: string) => {
  const snapshotPath = getSnapshotPath(topicId)
  const file = Bun.file(snapshotPath)
  if (!(await file.exists())) return

  const kindIndex: KindIndex = {}
  const timeIndex: TimeIndex = []

  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)

  for (let i = 0; i < bytes.length; ) {
    // find newline
    let j = i
    while (j < bytes.length && bytes[j] !== 0x0a) j++

    const line = new TextDecoder().decode(bytes.subarray(i, j))
    if (line) {
      const snapshot = JSON.parse(line) as SnapshotMessage

      let arr = kindIndex[snapshot.kind]
      if (!arr) {
        arr = []
        kindIndex[snapshot.kind] = arr
      }
      arr.push(i)

      timeIndex.push({ ts: Date.now(), offset: i })
    }

    i = j + 1 // skip newline
  }

  const paths = getIndexPaths(topicId)
  writeKindIndex(paths.kind, kindIndex)
  writeTimeIndex(paths.time, timeIndex)
}

export const readSnapshotsIndexed = async (
  topicId: string,
  {
    kinds,
    since,
    limit,
  }: {
    kinds?: Array<SnapshotMessage['kind']>
    since?: number
    limit?: number
  } = {},
): Promise<SnapshotMessage[]> => {
  const snapshotPath = getSnapshotPath(topicId)
  const file = Bun.file(snapshotPath)
  if (!(await file.exists())) return []

  const indexPaths = getIndexPaths(topicId)
  const kindIndex = await readKindIndex(indexPaths.kind)
  const timeIndex = await readTimeIndex(indexPaths.time)

  // Determine candidate offsets
  let offsets: number[] | undefined

  if (kinds !== undefined && kinds.length > 0) {
    offsets = kinds.flatMap((k) => kindIndex[k] ?? [])
    offsets = [...new Set(offsets)].sort((a, b) => a - b)
  }

  if (since !== undefined) {
    const timeOffsets = timeIndex.filter((t) => t.ts >= since).map((t) => t.offset)
    if (offsets === undefined) {
      offsets = timeOffsets
    } else {
      const timeSet = new Set(timeOffsets)
      offsets = offsets.filter((o) => timeSet.has(o))
    }
  }

  // Read from file
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)

  const results: SnapshotMessage[] = []
  const linesToRead = offsets === undefined ? findAllLineOffsets(bytes) : offsets

  for (const offset of linesToRead) {
    let end = offset
    while (end < bytes.length && bytes[end] !== 0x0a) end++
    const line = new TextDecoder().decode(bytes.subarray(offset, end))
    if (line) {
      results.push(JSON.parse(line) as SnapshotMessage)
    }

    if (limit !== undefined && results.length >= limit) {
      return results.slice(0, limit)
    }
  }

  return results
}

const findAllLineOffsets = (bytes: Uint8Array): number[] => {
  const offsets: number[] = []
  let i = 0
  while (i < bytes.length) {
    offsets.push(i)
    while (i < bytes.length && bytes[i] !== 0x0a) i++
    i++ // skip newline
  }
  return offsets
}
