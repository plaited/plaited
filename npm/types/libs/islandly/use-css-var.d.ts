/// <reference lib="dom" />
/** @description
 * set and get document level css variables
 */
export declare const useCSSVar: (variable: `var(--${string})` | `--${string}`) => readonly [() => string, (value: string | number, rem?: boolean) => void];
