import { test, expect  } from'@jest/globals'
import path from 'node:path'
import fg from 'fast-glob'
import { bundler } from '../bundler.js'

const srcDir = path.resolve(`src/tests/__mocks__/bundler`)

test('bundler: dev false', async ()=> {
  const actual: string[] = []
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.ts'))
  const bundles = await bundler({
    srcDir,
    entryPoints,
    reload: false,
  })
  for(const bundle of bundles) {
    actual.push(bundle[0])
  }
  expect(actual).toEqual([ '/example.stories.js',  '/nested/example.stories.js' ])
})

test('bundler: dev true', async ()=> {
  const actual: string[] = []
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.ts'))
  const bundles = await bundler({
    srcDir,
    entryPoints,
    reload: true,
  })
  for(const bundle of bundles) {
    actual.push(bundle[0])
  }
  expect(actual).toEqual([ '/example.stories.js',  '/nested/example.stories.js' ])
})
