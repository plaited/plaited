import { test, expect, beforeEach, afterEach  } from'@jest/globals'
import path from 'node:path'
import fs from 'node:fs/promises'
import fg from 'fast-glob'
import sinon from 'sinon'
import { getStoryMap } from '../get-story-map.js'
import { bundler } from '../bundler.js'
import { createTmpDir } from '../utils.js'
let logStub
let logMessages
let formattedEntries: string[]
let tempDirectory: string
beforeEach(() => {
  // Initialize logMessages array
  logMessages = []

  // Create a stub on console.log
  logStub = sinon.stub(console, 'error')

  // Replace console.log implementation to store log messages
  logStub.callsFake((...args) => {
    logMessages.push(args.join(' '))
  })
})

afterEach(async () => {
  // Restore console.log to its original implementation
  logStub.restore()
  // cleanup tmp directory
  await fs.rm(tempDirectory, { recursive:true })
})
test('getStoryMap: valid', async () => {
  const srcDir = path.resolve(`src/tests/__mocks__/get-story-valid`)
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.{tsx,ts}'))
  const bundles = await bundler({ srcDir, entryPoints,  reload: false })
  ;[ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  expect(storyMap).toMatchSnapshot()
})

test('getStoryMap: bad-meta', async () => {
  const srcDir = path.resolve(`src/tests/__mocks__/get-story-invalid/bad-meta`)
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.{tsx,ts}'))
  const bundles = await bundler({ srcDir, entryPoints,  reload: false })
  ;[ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  expect(logMessages.length).toBe(2)
  expect(logMessages.some(el => el.endsWith('is missing key values pairs'))).toBeTruthy()
  expect(logMessages.some(el => el.startsWith('Export: [ default ] '))).toBeTruthy()
  expect(storyMap.size).toBe(0)
})

test('getStoryMap: bad-title', async () => {
  const srcDir = path.resolve(`src/tests/__mocks__/get-story-invalid/bad-title`)
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.{tsx,ts}'))
  const bundles = await bundler({ srcDir, entryPoints,  reload: false })
  ;[ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  expect(logMessages.length).toBe(1)
  expect(logMessages[0].startsWith('Invalid title')).toBeTruthy()
  expect(storyMap.size).toBe(0)
})

test('getStoryMap: duplicate-title', async () => {
  const srcDir = path.resolve(`src/tests/__mocks__/get-story-invalid/duplicate-title`)
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.{tsx,ts}'))
  const bundles = await bundler({ srcDir, entryPoints,  reload: false })
  ;[ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  expect(logMessages.length).toBe(1)
  expect(logMessages[0].startsWith('Rename meta')).toBeTruthy()
  expect(storyMap.size).toBe(2)
})

test('getStoryMap: bad-story', async () => {
  const srcDir = path.resolve(`src/tests/__mocks__/get-story-invalid/bad-story`)
  const entryPoints = await fg(path.join(srcDir, '**/*.stories.{tsx,ts}'))
  const bundles = await bundler({ srcDir, entryPoints,  reload: false })
  ;[ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  expect(logMessages.length).toBe(3)
  expect(logMessages[0].startsWith('Invalid name')).toBeTruthy()
  expect(logMessages[1].startsWith('Exported Story: [ ')).toBeTruthy()
  expect(logMessages[2].endsWith('missing key values pairs')).toBeTruthy()
  expect(storyMap.size).toBe(0)
})

test('getStoryMap: duplicate-stories', async () => {
  const srcDir = path.resolve(`src/tests/__mocks__/get-story-invalid`)
  const entryPoints = await fg(path.join(srcDir, 'duplicate-stories.stories.tsx'))
  const bundles = await bundler({ srcDir, entryPoints,  reload: false })
  ;[ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  expect(logMessages.length).toBe(1)
  expect(logMessages[0].startsWith('Rename story:')).toBeTruthy()
  expect(storyMap.size).toBe(1)
})
