/**
 * File operation tools for reading, writing, and editing files.
 *
 * @remarks
 * Provides type-safe file operations using Bun's native file APIs.
 * These tools are designed for LLM invocation with Zod-validated inputs.
 *
 * @module
 */

import { dirname } from 'node:path'
import {
  type EditFileInput,
  EditFileInputSchema,
  type EditFileResult,
  type ReadFileInput,
  ReadFileInputSchema,
  type ReadFileResult,
  type WriteFileInput,
  WriteFileInputSchema,
  type WriteFileResult,
} from './file-ops.schemas.ts'

/**
 * Reads a file and returns its content.
 *
 * @remarks
 * Uses Bun.file() for efficient file reading.
 * Supports optional line range selection for large files.
 */
export const readFile = async (input: ReadFileInput): Promise<ReadFileResult> => {
  const { path, startLine, endLine } = ReadFileInputSchema.parse(input)

  try {
    const file = Bun.file(path)
    const exists = await file.exists()

    if (!exists) {
      return { success: false, error: 'File not found', path }
    }

    const fullContent = await file.text()

    // If no line range specified, return full content
    if (startLine === undefined && endLine === undefined) {
      return { success: true, content: fullContent, path }
    }

    // Extract line range
    const lines = fullContent.split('\n')
    const totalLines = lines.length
    const start = Math.max(1, startLine ?? 1)
    const end = Math.min(totalLines, endLine ?? totalLines)

    // Validate range
    if (start > totalLines) {
      return { success: false, error: `Start line ${start} exceeds file length (${totalLines} lines)`, path }
    }

    const selectedLines = lines.slice(start - 1, end)
    return {
      success: true,
      content: selectedLines.join('\n'),
      path,
      lines: { start, end, total: totalLines },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message, path }
  }
}

/**
 * Writes content to a file.
 *
 * @remarks
 * Uses Bun.write() for efficient file writing.
 * Optionally creates parent directories if they don't exist.
 */
export const writeFile = async (input: WriteFileInput): Promise<WriteFileResult> => {
  const { path, content, createDirs } = WriteFileInputSchema.parse(input)

  try {
    // Create parent directories if requested
    if (createDirs) {
      const dir = dirname(path)
      const dirFile = Bun.file(dir)
      const dirExists = await dirFile.exists()
      if (!dirExists) {
        await Bun.$`mkdir -p ${dir}`
      }
    }

    const bytesWritten = await Bun.write(path, content)
    return { success: true, path, bytesWritten }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message, path }
  }
}

/**
 * Edits a file by replacing a string.
 *
 * @remarks
 * Performs exact string replacement. The file must exist.
 * By default, replaces only the first occurrence.
 */
export const editFile = async (input: EditFileInput): Promise<EditFileResult> => {
  const { path, oldString, newString, replaceAll } = EditFileInputSchema.parse(input)

  try {
    const file = Bun.file(path)
    const exists = await file.exists()

    if (!exists) {
      return { success: false, error: 'File not found', path }
    }

    const content = await file.text()

    // Check if oldString exists in content
    if (!content.includes(oldString)) {
      return { success: false, error: 'String not found in file', path }
    }

    // Perform replacement
    let newContent: string
    let replacements: number

    if (replaceAll) {
      // Count occurrences before replacing
      const regex = new RegExp(escapeRegExp(oldString), 'g')
      const matches = content.match(regex)
      replacements = matches?.length ?? 0
      newContent = content.replaceAll(oldString, newString)
    } else {
      replacements = 1
      newContent = content.replace(oldString, newString)
    }

    await Bun.write(path, newContent)
    return { success: true, path, replacements }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message, path }
  }
}

/**
 * Escapes special regex characters in a string.
 * @internal
 */
const escapeRegExp = (string: string): string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
