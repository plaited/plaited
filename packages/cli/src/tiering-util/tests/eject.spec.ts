
import path from 'path'
import fs from 'fs/promises'
import test from 'ava'
import { run, ENTER } from './inquirer-test.js'
import { fileURLToPath } from 'url'


import { getStat } from '../../get-stat.js'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const source = path.resolve(__dirname, '__mocks__/eject/source/src')
export const target = path.resolve(__dirname, '__mocks__/eject/target/src')

test.after(async () => {
  await fs.rm(path.resolve(target, './multiply'), { recursive: true })
  await fs.writeFile(path.resolve(target, './index.ts'), "export * from 'mock/src/multiply'\n")
})

test('eject()', async t => {
  const cliPath = `${__dirname}/eject-wrapper.js`
  const expected = "export * from './multiply'\n"
  await run([ cliPath ], [ ENTER ])
  const actual1 = await fs.readFile(path.resolve(target, './index.ts'), { encoding: 'utf8' })
  t.is(actual1, expected)
  const actual2 = await getStat(path.resolve(target, './multiply/index.ts'))
  t.truthy(actual2)
  await run([ cliPath ], [ ENTER, 'y', ENTER ])
  const actual3 = await getStat(path.resolve(target, './multiply/index.ts'))
  t.truthy(actual3)
})

