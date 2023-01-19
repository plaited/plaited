
import path from 'path'
import fs from 'fs/promises'
import test from 'ava'
import { fileURLToPath } from 'url'


import { writeReExport } from '../write-re-export.js'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const source = path.resolve(__dirname, '__mocks__/write-re-export/source/src')
export const target = path.resolve(__dirname, '__mocks__/write-re-export/target/src')

test.before(async () => {
  await fs.writeFile(path.resolve(target, './index.ts'), '')
})

test('eject()', async t => {
  await writeReExport({ target, source, packageName: 'mock' })
  const expected = "export * from 'mock/src/divide'"
  const actual = await fs.readFile(path.resolve(target, './index.ts'), { encoding: 'utf8' })
  t.is(expected, actual)
})

