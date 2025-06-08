import { Glob } from 'bun'

import { STORY_GLOB_PATTERN } from '../testing/assert.constants'
import { TIMEOUT_ERROR } from './workshop.constants.js'

export async function globEntries(cwd: string): Promise<string[]> {
  const glob = new Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

/**
 * Custom error for test timeout scenarios.
 * Thrown when a test exceeds its specified timeout duration.
 *
 * @extends Error
 * @property name Constant identifier 'TIMEOUT_ERROR'
 *
 */
export class TimeoutError extends Error {
  override name = TIMEOUT_ERROR
  constructor(message: string) {
    super(message)
  }
}
