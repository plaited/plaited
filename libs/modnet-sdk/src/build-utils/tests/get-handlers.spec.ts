import { test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { useBundle } from '../use-bundle.js'
import { getHandlers } from '../get-handlers.js'

test('getHandlers', async () => {
  const registry = 'use_bundle'
  const db = new Database(':memory:')
  const query = db.query(`CREATE TABLE ${registry} (tag TEXT PRIMARY KEY, path TEXT NOT NULL)`)
  query.run()
  const cwd = import.meta.dir
  const bundle = useBundle(db, registry)
  const outputs = await bundle({ cwd })
  const map = await getHandlers(outputs)
  expect(map.size).toBe(4)
  expect(outputs.flatMap(({ kind, path }) => (kind === 'entry-point' ? path : []))).toMatchSnapshot()
})
