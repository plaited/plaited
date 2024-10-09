import { trueTypeOf } from './true-type-of.ts'
/** trueTypeOf a type predicate util function */
export const isTypeOf = <T>(obj: unknown, type: string): obj is T => trueTypeOf(obj) === type
