/**
 * Native streaming utilities for JSONL files.
 *
 * @remarks
 * Provides true memory-efficient streaming using Bun.file().stream().
 * Unlike the batch-then-yield approach in loading.ts, these functions
 * process data chunk-by-chunk, maintaining O(1) memory usage regardless
 * of file size.
 *
 * @packageDocumentation
 */

import type { ZodSchema } from 'zod'
import type { CaptureResult, PromptCase, TrialResult } from '../schemas.ts'
import { CaptureResultSchema, PromptCaseSchema, TrialResultSchema } from '../schemas.ts'

/**
 * Stream JSONL file entries with optional schema validation.
 *
 * @remarks
 * Uses Bun's native ReadableStream for true streaming - only holds one
 * chunk in memory at a time. For files with 10k+ results, this provides
 * constant memory usage vs O(file size) for batch loading.
 *
 * @typeParam T - The expected type of each JSON line
 * @param path - Path to the JSONL file
 * @param schema - Optional Zod schema for validation
 * @yields Parsed (and optionally validated) JSON objects
 * @throws Error with line number if JSON parsing or validation fails
 *
 * @public
 */
export async function* streamJsonl<T>(path: string, schema?: ZodSchema<T>): AsyncGenerator<T, void, unknown> {
  const file = Bun.file(path)
  const stream = file.stream()
  const decoder = new TextDecoder()

  let buffer = ''
  let lineNum = 0

  /**
   * Process a single line of JSON.
   */
  const processLine = (line: string): T => {
    const parsed = JSON.parse(line)
    return schema ? schema.parse(parsed) : (parsed as T)
  }

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      lineNum++

      if (line) {
        try {
          yield processLine(line)
        } catch (error) {
          throw new Error(`Invalid JSON at line ${lineNum}: ${error instanceof Error ? error.message : error}`)
        }
      }

      newlineIndex = buffer.indexOf('\n')
    }
  }

  // Flush remaining buffer content (handles files without trailing newline)
  buffer += decoder.decode()

  const finalLine = buffer.trim()
  if (finalLine) {
    lineNum++
    try {
      yield processLine(finalLine)
    } catch (error) {
      throw new Error(`Invalid JSON at line ${lineNum}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

/**
 * Stream prompt cases from a JSONL file.
 *
 * @remarks
 * Memory-efficient streaming with PromptCaseSchema validation.
 * Use this for large prompt files when you don't need random access.
 *
 * @param path - Path to the prompts.jsonl file
 * @yields Validated PromptCase objects
 * @throws Error with line number if validation fails
 *
 * @public
 */
export async function* streamPrompts(path: string): AsyncGenerator<PromptCase, void, unknown> {
  yield* streamJsonl<PromptCase>(path, PromptCaseSchema)
}

/**
 * Stream capture results from a JSONL file using native streaming.
 *
 * @remarks
 * True streaming alternative to the batch-then-yield streamResults in loading.ts.
 * Maintains O(1) memory usage regardless of file size.
 *
 * @param path - Path to the results.jsonl file
 * @yields Validated CaptureResult objects
 * @throws Error with line number if validation fails
 *
 * @public
 */
export async function* streamResultsNative(path: string): AsyncGenerator<CaptureResult, void, unknown> {
  yield* streamJsonl<CaptureResult>(path, CaptureResultSchema)
}

/**
 * Stream trial results from a JSONL file.
 *
 * @remarks
 * Memory-efficient streaming with TrialResultSchema validation.
 * Use for large trial result files from the trials command.
 *
 * @param path - Path to the trial results JSONL file
 * @yields Validated TrialResult objects
 * @throws Error with line number if validation fails
 *
 * @public
 */
export async function* streamTrialResults(path: string): AsyncGenerator<TrialResult, void, unknown> {
  yield* streamJsonl<TrialResult>(path, TrialResultSchema)
}

/**
 * Count lines in a JSONL file using streaming.
 *
 * @remarks
 * Counts non-empty lines without loading the entire file into memory.
 * Uses byte-level newline scanning for efficiency.
 *
 * @param path - Path to the JSONL file
 * @returns Number of non-empty lines
 *
 * @public
 */
export const countLinesStreaming = async (path: string): Promise<number> => {
  const file = Bun.file(path)
  const stream = file.stream()
  const decoder = new TextDecoder()

  let count = 0
  let buffer = ''

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line) count++
      newlineIndex = buffer.indexOf('\n')
    }
  }

  // Flush and check final line
  buffer += decoder.decode()
  if (buffer.trim()) count++

  return count
}
