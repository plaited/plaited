/** @internal Utilities for behavioral programming type guards and thread composition. */

import * as z from 'zod'
import { isTypeOf } from '../utils.ts'
import { RULES_FUNCTION_IDENTIFIER } from './behavioral.constants.ts'
import type { BPEvent, BPListener, BSync, BThread } from './behavioral.types.ts'

/**
 * Type guard to check if an unknown value conforms to the `BPEvent` structure.
 * Verifies if the value is an object with a `type` property that is a string.
 * This is useful for runtime validation of events, especially when receiving data
 * from external sources or when working with dynamically typed values.
 *
 * @param data - Value to check against the `BPEvent` structure.
 * @returns `true` if the value is a valid `BPEvent`, `false` otherwise.
 *
 * @see {@link BPEvent} for the structure being validated
 */
export const isBPEvent = (data: unknown): data is BPEvent => {
  return (
    isTypeOf<{ [key: string]: unknown }>(data, 'object') &&
    Object.hasOwn(data, 'type') &&
    isTypeOf<string>(data.type, 'string')
  )
}

/**
 * Type guard to check if a value is any Zod schema.
 *
 * @param schema - Value to validate.
 * @returns `true` when `schema` is a Zod schema instance.
 */
const isZodSchema = (schema: unknown): schema is z.ZodTypeAny => schema instanceof z.ZodType

/**
 * Type guard for structured match listeners used in waitFor/block/interrupt idioms.
 *
 * @param data - Value to validate as a `BPMatchListener`.
 * @returns `true` when `data` is a structured match listener.
 */
export const isBPMatchListener = (data: unknown): data is BPListener => {
  if (!isTypeOf<Record<string, unknown>>(data, 'object')) {
    return false
  }
  return (
    data.kind === 'match' &&
    isTypeOf<string>(data.type, 'string') &&
    isZodSchema(data.sourceSchema) &&
    isZodSchema(data.detailSchema)
  )
}

/**
 * Creates a behavioral thread (b-thread) by combining a sequence of synchronization rules.
 * A b-thread is a branded behavioral rule returned by `bThread()` that defines a strand of
 * behavior within a `bProgram`.
 *
 * @param rules - Sequential synchronization steps that define the thread.
 * @param repeat - Controls if and how the thread repeats its sequence.
 * @returns A `ReturnType<BSync>` representing the complete b-thread.
 *
 * @remarks
 * - Rules are executed sequentially
 * - Repetition is evaluated after completing all rules
 * - Threads can be interrupted mid-sequence
 *
 * @see {@link bSync} for creating individual rules
 * @see {@link ReturnType<BSync>} for the branded rule type
 */
export const bThread: BThread = (rules, repeat) => {
  const shouldRepeat = repeat === true
  return Object.assign(
    shouldRepeat
      ? function* () {
          while (shouldRepeat) {
            const length = rules.length
            for (let i = 0; i < length; i++) {
              yield* rules[i]!()
            }
          }
        }
      : function* () {
          const length = rules.length
          for (let i = 0; i < length; i++) {
            yield* rules[i]!()
          }
        },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )
}

/**
 * Type guard that checks whether an unknown value is a `ReturnType<BSync>` (b-thread or b-sync).
 *
 * @remarks
 * Returns `true` only for branded rule functions created by `bThread`/`bSync`.
 * Arbitrary functions or raw generator functions return `false`.
 *
 * @param obj - The value to test
 * @returns `true` if `obj` is a branded `ReturnType<BSync>`
 *
 * @public
 */
export const isBehavioralRule = (obj: unknown): obj is ReturnType<BSync> =>
  isTypeOf<object>(obj, 'generatorfunction') && '$' in obj && obj.$ === RULES_FUNCTION_IDENTIFIER

/**
 * Creates a single synchronization point for a b-thread.
 * This is the fundamental building block for constructing b-threads.
 *
 * @param syncPoint - `Idioms` object defining the synchronization behavior.
 * @returns Branded behavioral rule representing a single synchronization step.
 *
 * @remarks
 * - Each `bSync` creates one branded behavioral rule step
 * - Can be composed with `bThread` for sequences
 * - Supports all idioms: request, waitFor, block, interrupt
 *
 * @see {@link bThread} for composing multiple sync points
 * @see {@link Idioms} for synchronization options
 */
export const bSync: BSync = (syncPoint) =>
  Object.assign(
    function* () {
      yield syncPoint
    },
    { $: RULES_FUNCTION_IDENTIFIER } as const,
  )
