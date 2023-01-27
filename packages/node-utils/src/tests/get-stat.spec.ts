import path from 'path'
import test from 'ava'
import { fileURLToPath } from 'url'
import { getStat } from '../index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('getStat()', async t => {
  const actual1 = await getStat(path.resolve(__dirname, './__mocks__/file.ts'))
  t.truthy(actual1)
  const actual2 = await getStat(path.resolve(__dirname, './__mocks__/no-file.ts'))
  t.falsy(actual2)
  const actual3 = await getStat(path.resolve(__dirname, './__mocks__/source'))
  t.truthy(actual3?.isDirectory())
  const actual4 = await getStat(path.resolve(__dirname, './__mocks__/no_source'))
  t.falsy(actual4)
})
