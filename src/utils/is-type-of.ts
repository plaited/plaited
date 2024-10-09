import { trueTypeOf } from './true-type-of.ts'


export const isTypeOf = <T>(obj: unknown, type: string): obj is T => trueTypeOf(obj) === type;
