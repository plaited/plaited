import { test, expect, beforeEach, afterAll } from'@jest/globals'
import cp from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

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

beforeEach(async () => {
  await cleanup()
})

afterAll(async () => {
  await cleanup()
})

test('workshop:reload false', async () => {
  const entry = path.resolve('src/tests/workshop-reload-false.js')
  const child = cp.spawn('node', [ entry ])
  child.kill()
})

test.skip('workshop:reload true', async () => {
  const entry = path.resolve('src/tests/workshop-reload-true.js')
  const child = cp.spawn('node', [ entry ])
  child.kill()
})
