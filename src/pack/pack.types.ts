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
/**
 * Provision-time extensions to a tool's model-facing input. The model-facing
 * schema stays pure (no `call_id`, no `cwd`); the provisioner composes these
 * onto `run` — e.g. pinning a tool's working directory per space.
 */
export type ProvisionInput = Record<string, unknown>

/** Provision-time cwd scoping shared by every file tool. */
export type CwdProvision = { cwd?: string }

/** Provision-time byte ceiling for binary tool. */
export type BinaryProvision = { maxBytes?: number }

export type ToolArgs<I extends z.ZodType, O extends z.ZodType, P = unknown> = {
  readonly name: string
  readonly inputSchema: I
  readonly outputSchema: O
  /** `input` is the model-facing schema output intersected with provision-time `P`. */
  readonly run: (input: z.output<I> & P) => Promise<z.output<O>>
  readonly description?: string
}
