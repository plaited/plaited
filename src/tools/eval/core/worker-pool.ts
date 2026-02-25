/**
 * Promise-based worker pool for parallel task execution.
 *
 * @remarks
 * Implements a p-limit style concurrency limiter that:
 * - Processes items with configurable concurrency
 * - Maintains order-independent result collection
 * - Supports progress callbacks
 * - Coordinates file writes via mutex
 *
 * @packageDocumentation
 */

import { mkdir } from 'node:fs/promises'

// ============================================================================
// Types
// ============================================================================

/**
 * Progress callback for worker pool.
 *
 * @param completed - Number of completed tasks
 * @param total - Total number of tasks
 * @param result - Result of the just-completed task (if successful)
 * @param error - Error from the just-completed task (if failed)
 */
export type ProgressCallback<T> = (completed: number, total: number, result?: T, error?: Error) => void

/**
 * Options for worker pool execution.
 */
export type WorkerPoolOptions<T> = {
  /** Maximum concurrent workers (default: 1) */
  concurrency: number
  /** Progress callback called after each task completes */
  onProgress?: ProgressCallback<T>
}

/**
 * Result of worker pool execution.
 */
export type WorkerPoolResult<T> = {
  /** Successfully completed results (in completion order, not input order) */
  results: T[]
  /** Errors encountered during execution */
  errors: Array<{ index: number; error: Error }>
}

// ============================================================================
// Write Mutex for JSONL Coordination
// ============================================================================

/**
 * Simple mutex for coordinating file writes.
 *
 * @remarks
 * Uses a promise chain to ensure only one write happens at a time.
 * This prevents data corruption when multiple workers complete simultaneously.
 */
export type WriteMutex = {
  /** Acquire lock, execute write, release lock */
  write: (fn: () => Promise<void>) => Promise<void>
}

/**
 * Create a write mutex for coordinating file output.
 *
 * @returns WriteMutex instance
 */
export const createWriteMutex = (): WriteMutex => {
  let chain = Promise.resolve()

  return {
    write: (fn: () => Promise<void>): Promise<void> => {
      // Chain this write after all previous writes
      chain = chain.then(fn, fn) // Continue even if previous failed
      return chain
    },
  }
}

// ============================================================================
// Worker Pool Implementation
// ============================================================================

/**
 * Execute tasks in parallel with concurrency limit.
 *
 * @remarks
 * Uses a semaphore-style approach where workers grab the next available
 * task from a shared queue. Results are collected as tasks complete
 * (order may differ from input order).
 *
 * @param items - Array of items to process
 * @param worker - Async function to process each item
 * @param options - Pool configuration
 * @returns Results and any errors encountered
 *
 * @public
 */
export const runWorkerPool = async <TItem, TResult>(
  items: TItem[],
  worker: (item: TItem, index: number) => Promise<TResult>,
  options: WorkerPoolOptions<TResult>,
): Promise<WorkerPoolResult<TResult>> => {
  const { concurrency, onProgress } = options
  const results: TResult[] = []
  const errors: Array<{ index: number; error: Error }> = []

  // Fast path: if concurrency is 1, process sequentially
  if (concurrency === 1) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item === undefined) continue

      try {
        const result = await worker(item, i)
        results.push(result)
        onProgress?.(results.length + errors.length, items.length, result)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        errors.push({ index: i, error })
        onProgress?.(results.length + errors.length, items.length, undefined, error)
      }
    }
    return { results, errors }
  }

  // Shared state for work distribution
  let nextIndex = 0
  let completed = 0
  const mutex = { lock: Promise.resolve() }

  // Get next work item (thread-safe via single-threaded JS)
  // Uses iterative loop instead of recursion to avoid stack overflow with sparse arrays
  const getNextItem = (): { item: TItem; index: number } | undefined => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      const item = items[index]
      if (item !== undefined) {
        return { item, index }
      }
      // Skip undefined items and continue to next
    }
    return undefined
  }

  // Worker function that processes items until none remain
  const runWorker = async (): Promise<void> => {
    let work = getNextItem()
    while (work) {
      const { item, index } = work
      try {
        const result = await worker(item, index)

        // Coordinate result collection
        await new Promise<void>((resolve) => {
          mutex.lock = mutex.lock.then(() => {
            results.push(result)
            completed++
            onProgress?.(completed, items.length, result)
            resolve()
          })
        })
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))

        // Coordinate error collection
        await new Promise<void>((resolve) => {
          mutex.lock = mutex.lock.then(() => {
            errors.push({ index, error })
            completed++
            onProgress?.(completed, items.length, undefined, error)
            resolve()
          })
        })
      }

      work = getNextItem()
    }
  }

  // Start N workers
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker())
  await Promise.all(workers)

  return { results, errors }
}

// ============================================================================
// Workspace Directory Management
// ============================================================================

/**
 * Create a workspace directory for a prompt.
 *
 * @remarks
 * Creates an isolated directory for each prompt execution.
 * Directory is created if it doesn't exist. Directories persist
 * after completion for debugging/inspection - clean up manually
 * or via CI scripts if disk space is a concern.
 *
 * @param baseDir - Base workspace directory
 * @param promptId - Unique prompt identifier
 * @returns Absolute path to the workspace directory
 *
 * @public
 */
export const createWorkspaceDir = async (baseDir: string, promptId: string): Promise<string> => {
  // Sanitize promptId for filesystem (replace invalid chars with underscore)
  const sanitizedId = promptId.replace(/[<>:"/\\|?*]/g, '_')
  const workspaceDir = `${baseDir}/prompt-${sanitizedId}`

  // Create directory (recursive, no error if exists)
  // Uses fs.mkdir instead of shell to prevent command injection
  await mkdir(workspaceDir, { recursive: true })

  return workspaceDir
}
