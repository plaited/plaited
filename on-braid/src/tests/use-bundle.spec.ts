import { test, expect } from 'bun:test'
import { Database } from 'bun:sqlite'
import { useBundle } from '../use-bundle.js'

test('useBundle', async () => {
  const registry = 'use_bundle'
  const db = new Database(':memory:')
  const query = db.query(`CREATE TABLE ${registry} (tag TEXT PRIMARY KEY, path TEXT NOT NULL)`)
  query.run()
  const cwd = import.meta.dir
  const bundle = useBundle(db, registry)
  const outputs = await bundle({ cwd })
  expect(outputs?.length).toBe(4)
  expect(outputs.filter((output) => output?.kind === 'entry-point').length).toBe(3)
  expect(outputs.filter((output) => output?.kind === 'chunk').length).toBe(1)
  expect(outputs.every(({ path }) => path.startsWith('./'))).toBe(true)
  expect(outputs[0].type).toBe('text/javascript;charset=utf-8')
})
