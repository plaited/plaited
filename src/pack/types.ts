import type * as z from 'zod'

/**
 * The plain-data shape consumed by {@link useTool} as its second argument.
 *
 * Tools in `src/pack/` export a frozen `ToolArgs` object — no hooks, no
 * engine imports, testable without the behavioral program.
 *
 * Purity rule: schemas must never contain `call_id` — it is the loop's
 * envelope, stamped at dispatch time.
 */
export type ToolArgs<I extends z.ZodType, O extends z.ZodType> = {
  readonly name: string
  readonly inputSchema: I
  readonly outputSchema: O
  readonly run: (input: z.output<I>) => Promise<z.output<O>>
  readonly description?: string
}
