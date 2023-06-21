import { test, expect } from 'bun:test'
import path from 'node:path'
import { bundler } from '../bundler.js'
import { Bundles } from '../types.js'
console.log(path.dirname(`${process.cwd()}/**/*.stories.ts`))

test('bundler: dev false', async ()=> {
  const actual: string[] = []
  await bundler({
    root: `${process.cwd()}/src/tests/__mocks__`,
    dev: false,
    ext: '.stories.ts',
    setRoutes: async (bundles: Bundles) => {
      for(const bundle of bundles) {
        actual.push(bundle[0])
      }
    }, 
  })
  expect(actual).toEqual([ 'example.stories.js',  'nested/example.stories.js' ])
})

test('bundler: dev true', async ()=> {
  const actual: string[] = []
  await bundler({
    root: `${process.cwd()}/src/tests/__mocks__`,
    ext: '.stories.ts',
    dev: true,
    setRoutes: async (bundles: Bundles) => {
      for(const bundle of bundles) {
        actual.push(bundle[0])
      }
    }, 
  })
  expect(actual).toEqual([ 'example.stories.js',  'nested/example.stories.js' ])
})
