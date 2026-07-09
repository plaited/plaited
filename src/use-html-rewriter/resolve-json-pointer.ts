/**
 * RFC 6901 JSON Pointer path resolver.
 *
 * Resolves a JSON Pointer string (`/foo/0/bar`) against a data structure.
 * Used internally for scoped-path resolution inside looped template items.
 *
 * @remarks
 * - `/` separates tokens
 * - `~1` → `/`, `~0` → `~` in tokens
 * - `/` alone = root key (valid for objects with key `""`)
 * - empty pointer = the whole document
 * - array indices are numeric tokens
 * - missing token → throws InvalidDescriptorError with the path + missing token
 *
 * @public
 */

import { InvalidDescriptorError } from './use-html-rewriter.errors.ts'

const SLASH_REGEX = /~1/g
const TILDE_REGEX = /~0/g

/**
 * Unescape a JSON Pointer token per RFC 6901 §3.
 * `~1` → `/`, `~0` → `~`. Order matters: decode tilde first, then slash.
 */
const unescapeToken = (token: string): string => token.replace(TILDE_REGEX, '~').replace(SLASH_REGEX, '/')

/**
 * Resolve a JSON Pointer path against a data structure.
 *
 * @param data - The root data object
 * @param pointer - RFC 6901 JSON Pointer string
 * @returns The resolved value at the pointer path
 * @throws {@link InvalidDescriptorError} if a token along the path is missing
 *
 * @example
 * ```ts
 * resolveJsonPointer({ foo: { bar: [1, 2] } }, '/foo/bar/0') // → 1
 * resolveJsonPointer({ foo: 42 }, '') // → { foo: 42 }
 * resolveJsonPointer({ '': 'root' }, '/') // → 'root'
 * ```
 */
export const resolveJsonPointer = (data: unknown, pointer: string): unknown => {
  // Empty pointer = whole document
  if (pointer === '') return data

  // Remove leading slash and split
  const tokens = pointer.startsWith('/') ? pointer.slice(1).split('/') : pointer.split('/')

  let current: unknown = data
  for (const rawToken of tokens) {
    const token = unescapeToken(rawToken)

    if (current === null || current === undefined) {
      throw new InvalidDescriptorError(
        `Cannot resolve pointer "${pointer}": reached null/undefined before token "${token}"`,
        { pointer, token },
      )
    }

    if (typeof current === 'object' && current !== null) {
      if (Array.isArray(current)) {
        const index = parseInt(token, 10)
        if (isNaN(index)) {
          throw new InvalidDescriptorError(
            `Cannot resolve pointer "${pointer}": expected numeric index at token "${token}" for array`,
            { pointer, token },
          )
        }
        if (index < 0 || index >= current.length) {
          throw new InvalidDescriptorError(
            `Cannot resolve pointer "${pointer}": index ${index} out of bounds (length ${current.length}) at token "${token}"`,
            { pointer, token },
          )
        }
        current = current[index]
      } else {
        const obj = current as Record<string, unknown>
        if (!(token in obj)) {
          throw new InvalidDescriptorError(`Cannot resolve pointer "${pointer}": key "${token}" not found in object`, {
            pointer,
            token,
          })
        }
        current = obj[token]
      }
    } else {
      throw new InvalidDescriptorError(
        `Cannot resolve pointer "${pointer}": cannot index into primitive value at token "${token}"`,
        { pointer, token },
      )
    }
  }

  return current
}
