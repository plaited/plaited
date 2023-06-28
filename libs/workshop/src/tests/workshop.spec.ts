import { test, beforeEach, afterEach, expect } from'@jest/globals'
import fs from 'node:fs/promises'
import path from 'node:path'
import { workshop } from '../workshop.js'
import fg from 'fast-glob'
import cp from 'node:child_process'
import { wait } from '@plaited/utils'

const testDir = path.resolve('.playwright')

const cleanup = async () => {
  let exist = true
  try {
    await fs.stat(testDir)
  } catch {
    exist = false
  }
  exist && await fs.rm(testDir , { recursive: true })
}

const countFiles = async dir => {
  let fileCount = 0

  const processDirectory = async directory => {
    const entries = await fs.readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await processDirectory(fullPath)
      } else if (entry.isFile()) {
        fileCount++
      }
    }
  }

  await processDirectory(dir)
  return fileCount
}
beforeEach(async() => {
  await cleanup()
})
afterEach(async() => {
  await cleanup()
})

test('workshop: reload false', async () => {
  const server = await workshop({
    exts: '.stories.tsx',
    srcDir: 'src/tests/__mocks__/get-story-valid',
    testDir: '.playwright',
    reload: true,
  })
  
  server.start()
  
  await wait(1_000)
  server.stop()
  const count = await countFiles(path.resolve('.playwright'))
  expect(count).toBe(4)
  const entries = await fg(path.resolve('.playwright', '**/*.spec.ts'))
  for(const entry of entries.sort(new Intl.Collator('en-US').compare)) {
    const testFile = await fs.readFile(entry, { encoding: 'utf8' })
    expect(testFile).toMatchSnapshot()
  }
  
})

test('workshop: reload true', async () => {
  // const child = cp.spawn('node', [ 'src/test/workshop-reload.js' ])
  const server = await workshop({
    exts: '.stories.tsx',
    srcDir: 'src/tests/__mocks__/get-story-valid',
    testDir: '.playwright',
    reload: true,
  })
  
  server.start()
  await wait(1_000)
  let count = await countFiles(path.resolve('.playwright'))
  expect(count).toBe(4)
  const entries = await fg(path.resolve('.playwright', '**/*.spec.ts'))
  for(const entry of entries.sort(new Intl.Collator('en-US').compare)) {
    const testFile = await fs.readFile(entry, { encoding: 'utf8' })
    expect(testFile).toMatchSnapshot()
  }
  const filePath = path.resolve('src/tests/__mocks__/get-story-valid/example.stories.tsx')
  const original = await fs.readFile(filePath)
  await fs.appendFile(filePath, `\n export const reloadStory: Story = {
    description: 'renders with placeholder',
    attrs: {},
  }` )
  await wait(1_000)
  count = await countFiles(path.resolve('.playwright'))
  // Adds test when story changed
  expect(count).toBe(5)
  await fs.writeFile(filePath, original)
  const testFilePath =  path.resolve('.playwright/example-stories--reload-story.spec.ts')
  const testFile = await fs.readFile(testFilePath, { encoding: 'utf8' })
  expect(testFile).toMatchSnapshot()
  await fs.rm(testFilePath)
  await wait(1_000)
  server.stop()
  count = await countFiles(path.resolve('.playwright'))
  // Cleanups unused tests when story deleted
  expect(count).toBe(4)
})
