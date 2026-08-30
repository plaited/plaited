import type { AddHandler, AddThread, Trigger } from '../main/behavioral.types.ts'
import bashTool from '../pack/bash.ts'
import editTool from '../pack/edit.ts'
import findTool from '../pack/find.ts'
import grepTool from '../pack/grep.ts'
import lsTool from '../pack/ls.ts'
import type { CwdProvision, ToolArgs } from '../pack/pack.types.ts'
import readTool from '../pack/read.ts'
import writeTool from '../pack/write.ts'
import type { ToolDescriptor } from './use-tool.ts'
import { useTool } from './use-tool.ts'

/**
 * The unscoped behavioral hooks the agent harness receives at registration time.
 */
export type AgentHooks = {
  addThread: AddThread
  addHandler: AddHandler
  trigger: Trigger
}

/**
 * Provision-time scoping applied to every tool in the pack.
 *
 * - `cwd` — the space's working directory: bash spawns there; file tools
 *   resolve relative paths against it (grep/find default their search root
 *   to it). Absolute model-supplied paths still win — path sandboxing is a
 *   Phase 5 policy concern (guards / run-composition), not a schema one.
 */
export type ProvisionOptions = CwdProvision

/**
 * Provision the default tool pack into the given behavioral hooks.
 *
 * Wires all seven core tools (read, bash, edit, write, grep, find, ls) by
 * calling `useTool` with the frozen `ToolArgs` from `src/pack/`. When
 * `options.cwd` is given, every tool's `run` is composed to execute within
 * that directory — the pack's data stays pure, the provisioner does the
 * composition.
 *
 * @param hooks - Behavioral hooks providing `addHandler` and `trigger` for
 *   tool registration.
 * @param options - Provision-time scoping (cwd) applied to every tool.
 * @returns An array of registered tool descriptors.
 */
export const provisionDefaults = (hooks: AgentHooks, options?: ProvisionOptions): ToolDescriptor[] => {
  const bindTool = <
    I extends import('zod').ZodType,
    O extends import('zod').ZodType,
    P extends Record<string, unknown>,
  >(
    args: ToolArgs<I, O, P>,
  ): ToolDescriptor => useTool({ addHandler: hooks.addHandler, trigger: hooks.trigger }, args)

  const bind = <I extends import('zod').ZodType, O extends import('zod').ZodType>(
    tool: ToolArgs<I, O, CwdProvision>,
  ): ToolDescriptor =>
    options?.cwd === undefined
      ? bindTool(tool)
      : bindTool({
          ...tool,
          run: (input) => tool.run({ ...input, cwd: options.cwd }),
        })

  return [bind(readTool), bind(bashTool), bind(editTool), bind(writeTool), bind(grepTool), bind(findTool), bind(lsTool)]
}
