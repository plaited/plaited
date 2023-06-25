import { test, expect, beforeEach, afterEach  } from'@jest/globals'
import path from 'node:path'
import fg from 'fast-glob'
import sinon from 'sinon'
import { getStoryMap } from '../get-story-map.js'


let logStub
let logMessages

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

afterEach(() => {
  // Restore console.log to its original implementation
  logStub.restore()
})
test('getStoryMap: valid', async () => {
  const srcDir = `${process.cwd()}/src/tests/__mocks__/get-story-valid`
  const entryPoints = await fg(path.resolve(srcDir, '**/*.stories.{tsx,ts}'))

  const storyMap = await getStoryMap(entryPoints, srcDir)
  expect(storyMap).toMatchSnapshot()
})

test('getStoryMap: bad-meta', async () => {
  const srcDir = `${process.cwd()}/src/tests/__mocks__/get-story-invalid/bad-meta`
  const entryPoints = await fg(path.resolve(srcDir, '**/*.stories.{tsx,ts}'))
  const storyMap = await getStoryMap(entryPoints, srcDir)
  expect(logMessages.length).toBe(2)
  expect(logMessages.some(el => el.endsWith('is missing key values pairs'))).toBeTruthy()
  expect(logMessages.some(el => el.startsWith('Export: [ default ] '))).toBeTruthy()
  expect(storyMap.size).toBe(0)
})

test('getStoryMap: bad-title', async () => {
  const srcDir = `${process.cwd()}/src/tests/__mocks__/get-story-invalid/bad-title`
  const entryPoints = await fg(path.resolve(srcDir, '**/*.stories.{tsx,ts}'))
  const storyMap = await getStoryMap(entryPoints, srcDir)
  expect(logMessages.length).toBe(1)
  expect(logMessages[0].startsWith('Invalid title')).toBeTruthy()
  expect(storyMap.size).toBe(0)
})

test('getStoryMap: duplicate-title', async () => {
  const srcDir = `${process.cwd()}/src/tests/__mocks__/get-story-invalid/duplicate-title`
  const entryPoints = await fg(path.resolve(srcDir, '**/*.stories.{tsx,ts}'))
  const storyMap = await getStoryMap(entryPoints, srcDir)
  expect(logMessages.length).toBe(1)
  expect(logMessages[0].startsWith('Rename meta')).toBeTruthy()
  expect(storyMap.size).toBe(2)
})

test('getStoryMap: bad-story', async () => {
  const srcDir = `${process.cwd()}/src/tests/__mocks__/get-story-invalid/bad-story`
  const entryPoints = await fg(path.resolve(srcDir, '**/*.stories.{tsx,ts}'))
  const storyMap = await getStoryMap(entryPoints, srcDir)
  expect(logMessages.length).toBe(3)
  expect(logMessages[0].startsWith('Invalid name')).toBeTruthy()
  expect(logMessages[1].startsWith('Exported Story: [ ')).toBeTruthy()
  expect(logMessages[2].endsWith('missing key values pairs')).toBeTruthy()
  expect(storyMap.size).toBe(0)
})

test('getStoryMap: duplicate-stories', async () => {
  const srcDir = `${process.cwd()}/src/tests/__mocks__/get-story-invalid`
  const entryPoints = await fg(path.resolve(srcDir, 'duplicate-stories.stories.tsx'))
  const storyMap = await getStoryMap(entryPoints, srcDir)
  expect(logMessages.length).toBe(1)
  expect(logMessages[0].startsWith('Rename story:')).toBeTruthy()
  expect(storyMap.size).toBe(1)
})
