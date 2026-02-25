/**
 * Format detection for compare command.
 *
 * @remarks
 * Auto-detects whether input files contain CaptureResult or TrialResult data
 * by inspecting the first line of the JSONL file.
 *
 * Detection logic:
 * - TrialResult: has `trials` array and `k` number
 * - CaptureResult: has `trajectory` array and `timing` object
 *
 * @packageDocumentation
 */

/** Detected input format for compare command */
export type CompareInputFormat = 'capture' | 'trials'

/**
 * Detect input format from JSONL file.
 *
 * @remarks
 * Reads the first non-empty line of the file and checks for
 * discriminating fields to determine the format.
 *
 * @param path - Path to JSONL file
 * @returns Detected format ('capture' or 'trials')
 * @throws Error if file is empty or format cannot be detected
 *
 * @public
 */
export const detectInputFormat = async (path: string): Promise<CompareInputFormat> => {
  const file = Bun.file(path)
  const text = await file.text()
  const firstLine = text.split('\n').find((line) => line.trim())

  if (!firstLine) {
    throw new Error(`Empty file: ${path}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(firstLine)
  } catch {
    throw new Error(`Invalid JSON in first line of: ${path}`)
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Expected object in first line of: ${path}`)
  }

  const obj = parsed as Record<string, unknown>

  // TrialResult has `trials` array and `k` number
  if ('trials' in obj && Array.isArray(obj.trials) && 'k' in obj && typeof obj.k === 'number') {
    return 'trials'
  }

  // CaptureResult has `trajectory` array and `timing` object
  if ('trajectory' in obj && Array.isArray(obj.trajectory) && 'timing' in obj && typeof obj.timing === 'object') {
    return 'capture'
  }

  throw new Error(
    `Unable to detect format for: ${path}. ` +
      `Expected either TrialResult (with trials/k fields) or CaptureResult (with trajectory/timing fields).`,
  )
}

/**
 * Validate that all files have the same format.
 *
 * @param paths - Paths to JSONL files
 * @returns Detected format (all files must match)
 * @throws Error if files have different formats
 *
 * @public
 */
export const detectAndValidateFormat = async (paths: string[]): Promise<CompareInputFormat> => {
  const firstPath = paths[0]
  if (!firstPath) {
    throw new Error('No files provided for format detection')
  }

  const format = await detectInputFormat(firstPath)

  for (let i = 1; i < paths.length; i++) {
    const path = paths[i]
    if (!path) continue

    const otherFormat = await detectInputFormat(path)
    if (otherFormat !== format) {
      throw new Error(
        `Format mismatch: ${firstPath} is ${format}, but ${path} is ${otherFormat}. ` +
          `All files must have the same format.`,
      )
    }
  }

  return format
}
