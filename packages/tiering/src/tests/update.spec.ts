
import path from 'path'
import fs from 'fs/promises'
import test from 'ava'
import { run, ENTER, SPACE } from './inquirer-test.js'
import { fileURLToPath } from 'url'


const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const source = path.resolve(__dirname, '__mocks__/update/source/src')
export const target = path.resolve(__dirname, '__mocks__/update/target/src')

test.after(async () => {
  await fs.rm(target, { recursive: true })
  await fs.mkdir(target)
  await fs.writeFile(path.resolve(target, './index.ts'), "export * from './divide'\n" +
  "export * from './multiply'")
})

test('update()', async t => {
  const cliPath = `${__dirname}/update-wrapper.js`
  const expected1 = "export * from './divide'\n"+ "export * from 'mock/src/multiply'"
  await run([ cliPath ], [ 'y', ENTER, SPACE, ENTER ])
  const actual1 = await fs.readFile(path.resolve(target, './index.ts'), { encoding: 'utf8' })
  t.is(actual1, expected1)
  await fs.writeFile(path.resolve(target, './index.ts'), "export * from './divide'\n" +
  "export * from './multiply'")
  const expected2 = "export * from './divide'\n" +
  "export * from './multiply'"
  await run([ cliPath ], [ 'y', ENTER, 'a', ENTER ])
  const actual2 = await fs.readFile(path.resolve(target, './index.ts'), { encoding: 'utf8' })
  t.is(actual2, expected2)
})
