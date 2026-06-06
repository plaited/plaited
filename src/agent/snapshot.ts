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
