/**
 * Unit tests for worker pool utilities.
 *
 * @remarks
 * Tests for parallel execution utilities:
 * - runWorkerPool: Promise-based worker pool with concurrency limit
 * - createWriteMutex: Coordinates concurrent file writes
 * - createWorkspaceDir: Creates per-prompt workspace directories
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { rm, stat } from 'node:fs/promises'
import { createWorkspaceDir, createWriteMutex, runWorkerPool } from '../worker-pool.ts'

// Helper to check if a directory exists
const dirExists = async (path: string): Promise<boolean> => {
  try {
    const s = await stat(path)
    return s.isDirectory()
  } catch {
    return false
  }
}

// ============================================================================
// runWorkerPool Tests
// ============================================================================

describe('runWorkerPool', () => {
  test('processes items sequentially with concurrency 1', async () => {
    const order: number[] = []
    const items = [1, 2, 3, 4, 5]

    const { results } = await runWorkerPool(
      items,
      async (item) => {
        order.push(item)
        return item * 2
      },
      { concurrency: 1 },
    )

    // With concurrency 1, order should be preserved
    expect(order).toEqual([1, 2, 3, 4, 5])
    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  test('processes items in parallel with concurrency > 1', async () => {
    const items = [1, 2, 3, 4]
    const startTimes: number[] = []

    const { results } = await runWorkerPool(
      items,
      async (item, index) => {
        startTimes[index] = Date.now()
        await Bun.sleep(50) // Simulate work
        return item * 2
      },
      { concurrency: 4 },
    )

    // All results should be correct
    expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8])

    // With concurrency 4, all items should start nearly simultaneously
    const maxDiff = Math.max(...startTimes) - Math.min(...startTimes)
    expect(maxDiff).toBeLessThan(30) // Should all start within 30ms
  })

  test('limits concurrency correctly', async () => {
    let activeCount = 0
    let maxActive = 0
    const items = [1, 2, 3, 4, 5, 6]

    await runWorkerPool(
      items,
      async (item) => {
        activeCount++
        maxActive = Math.max(maxActive, activeCount)
        await Bun.sleep(20) // Simulate work
        activeCount--
        return item
      },
      { concurrency: 2 },
    )

    // Should never exceed concurrency limit
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  test('collects errors without stopping other workers', async () => {
    const items = [1, 2, 3, 4, 5]

    const { results, errors } = await runWorkerPool(
      items,
      async (item) => {
        if (item === 3) {
          throw new Error('Item 3 failed')
        }
        return item * 2
      },
      { concurrency: 2 },
    )

    // Should have 4 results and 1 error
    expect(results.length).toBe(4)
    expect(errors.length).toBe(1)
    expect(errors[0]?.index).toBe(2) // Index of item 3
    expect(errors[0]?.error.message).toBe('Item 3 failed')
  })

  test('calls onProgress callback', async () => {
    const progressCalls: Array<{ completed: number; total: number }> = []
    const items = [1, 2, 3]

    await runWorkerPool(items, async (item) => item * 2, {
      concurrency: 1,
      onProgress: (completed, total) => {
        progressCalls.push({ completed, total })
      },
    })

    expect(progressCalls.length).toBe(3)
    expect(progressCalls[0]).toEqual({ completed: 1, total: 3 })
    expect(progressCalls[1]).toEqual({ completed: 2, total: 3 })
    expect(progressCalls[2]).toEqual({ completed: 3, total: 3 })
  })

  test('handles empty items array', async () => {
    const { results, errors } = await runWorkerPool([] as number[], async (item) => item * 2, { concurrency: 4 })

    expect(results).toEqual([])
    expect(errors).toEqual([])
  })

  test('skips undefined items in array', async () => {
    // Create a sparse array with holes
    const items: (number | undefined)[] = [1, undefined, 3, undefined, 5]

    const { results } = await runWorkerPool(
      items,
      async (item) => {
        if (item === undefined) throw new Error('Should not process undefined')
        return item * 2
      },
      { concurrency: 2 },
    )

    // Should only process defined items
    expect(results.sort((a, b) => a - b)).toEqual([2, 6, 10])
  })

  test('handles concurrency greater than items count', async () => {
    const items = [1, 2]
    const { results } = await runWorkerPool(items, async (item) => item * 2, { concurrency: 10 })

    expect(results.sort((a, b) => a - b)).toEqual([2, 4])
  })
})

// ============================================================================
// createWriteMutex Tests
// ============================================================================

describe('createWriteMutex', () => {
  test('serializes concurrent writes', async () => {
    const mutex = createWriteMutex()
    const order: number[] = []

    // Start multiple writes concurrently
    const promises = [1, 2, 3, 4, 5].map((n) =>
      mutex.write(async () => {
        await Bun.sleep(10) // Simulate write delay
        order.push(n)
      }),
    )

    await Promise.all(promises)

    // All writes should complete in order
    expect(order).toEqual([1, 2, 3, 4, 5])
  })

  test('continues after failed write', async () => {
    const mutex = createWriteMutex()
    const order: number[] = []

    const promise1 = mutex.write(async () => {
      order.push(1)
    })

    const promise2 = mutex.write(async () => {
      order.push(2)
      throw new Error('Write 2 failed')
    })

    const promise3 = mutex.write(async () => {
      order.push(3)
    })

    await promise1
    await promise2.catch(() => {}) // Ignore error
    await promise3

    // All writes should execute in order, even after failure
    expect(order).toEqual([1, 2, 3])
  })

  test('returns promise that resolves when write completes', async () => {
    const mutex = createWriteMutex()
    let writeCompleted = false

    const promise = mutex.write(async () => {
      await Bun.sleep(10)
      writeCompleted = true
    })

    expect(writeCompleted).toBe(false)
    await promise
    expect(writeCompleted).toBe(true)
  })
})

// ============================================================================
// createWorkspaceDir Tests
// ============================================================================

describe('createWorkspaceDir', () => {
  const testBaseDir = '/tmp/worker-pool-test-workspaces'

  afterEach(async () => {
    try {
      await rm(testBaseDir, { recursive: true, force: true })
    } catch {
      // Ignore if doesn't exist
    }
  })

  test('creates workspace directory', async () => {
    const workspaceDir = await createWorkspaceDir(testBaseDir, 'test-prompt-1')

    expect(workspaceDir).toBe(`${testBaseDir}/prompt-test-prompt-1`)
    expect(await dirExists(workspaceDir)).toBe(true)
  })

  test('sanitizes invalid filesystem characters', async () => {
    const workspaceDir = await createWorkspaceDir(testBaseDir, 'test<>:"/\\|?*prompt')

    // Invalid characters should be replaced with underscore
    expect(workspaceDir).toBe(`${testBaseDir}/prompt-test_________prompt`)
    expect(await dirExists(workspaceDir)).toBe(true)
  })

  test('handles existing directory', async () => {
    // Create first
    const dir1 = await createWorkspaceDir(testBaseDir, 'existing')
    // Create same again
    const dir2 = await createWorkspaceDir(testBaseDir, 'existing')

    expect(dir1).toBe(dir2)
    expect(await dirExists(dir1)).toBe(true)
  })

  test('creates nested base directory', async () => {
    const nestedBase = `${testBaseDir}/deep/nested/path`
    const workspaceDir = await createWorkspaceDir(nestedBase, 'prompt-1')

    expect(workspaceDir).toBe(`${nestedBase}/prompt-prompt-1`)
    expect(await dirExists(workspaceDir)).toBe(true)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('worker pool with write mutex integration', () => {
  test('coordinates writes from concurrent workers', async () => {
    const mutex = createWriteMutex()
    const writeOrder: string[] = []
    const items = ['a', 'b', 'c', 'd', 'e']

    await runWorkerPool(
      items,
      async (item) => {
        // Simulate variable processing time
        await Bun.sleep(Math.random() * 20)

        // Write with mutex coordination
        await mutex.write(async () => {
          writeOrder.push(item)
        })

        return item
      },
      { concurrency: 3 },
    )

    // All items should be written exactly once
    expect(writeOrder.sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
    // Order depends on which worker finishes first, but all should be present
    expect(writeOrder.length).toBe(5)
  })

  test('produces valid JSONL with concurrent writes to file', async () => {
    const mutex = createWriteMutex()
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `test-${i}`, value: i }))

    // Collect lines in memory, then verify structure
    const lines: string[] = []

    await runWorkerPool(
      items,
      async (item) => {
        // Simulate variable processing time
        await Bun.sleep(Math.random() * 30)

        // Write JSONL line with mutex coordination (same pattern as capture.ts)
        await mutex.write(async () => {
          const line = JSON.stringify(item)
          lines.push(line)
        })

        return item
      },
      { concurrency: 4 },
    )

    // Should have all 10 items
    expect(lines.length).toBe(10)

    // Each line should be valid JSON
    const parsed = lines.map((line) => JSON.parse(line))
    const ids = parsed.map((p) => p.id).sort()

    // All items present (order may vary)
    expect(ids).toEqual(items.map((i) => i.id).sort())
  })

  test('creates workspace directories concurrently without collision', async () => {
    const testBase = '/tmp/worker-pool-workspace-test'
    const items = ['prompt-1', 'prompt-2', 'prompt-3', 'prompt-4', 'prompt-5']

    // Clean up first
    try {
      await rm(testBase, { recursive: true, force: true })
    } catch {
      // Ignore
    }

    const createdDirs: string[] = []

    await runWorkerPool(
      items,
      async (promptId) => {
        const dir = await createWorkspaceDir(testBase, promptId)
        createdDirs.push(dir)
        return dir
      },
      { concurrency: 5 },
    )

    // All directories created
    expect(createdDirs.length).toBe(5)

    // Verify each directory exists
    for (const dir of createdDirs) {
      const exists = await dirExists(dir)
      expect(exists).toBe(true)
    }

    // Cleanup
    await rm(testBase, { recursive: true, force: true })
  })
})
