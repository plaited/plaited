import type { AddHandler, AddThread, Trigger } from '../main/behavioral.types.ts'
import bashTool from '../pack/bash.ts'
import editTool from '../pack/edit.ts'
import findTool from '../pack/find.ts'
import grepTool from '../pack/grep.ts'
import lsTool from '../pack/ls.ts'
import type { ToolArgs } from '../pack/pack.types.ts'
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
 * Provision the default tool pack into the given behavioral hooks.
 *
 * Wires all seven core tools (read, bash, edit, write, grep, find, ls) by
 * calling `useTool` with the frozen `ToolArgs` from `src/pack/`.
 *
 * @param hooks - Behavioral hooks providing `addHandler` and `trigger` for
 *   tool registration.
 * @returns An array of registered tool descriptors.
 */
export const provisionDefaults = (hooks: AgentHooks): ToolDescriptor[] => {
  const bindTool = <
    I extends import('zod').ZodType,
    O extends import('zod').ZodType,
    P extends Record<string, unknown>,
  >(
    args: ToolArgs<I, O, P>,
  ): ToolDescriptor => useTool({ addHandler: hooks.addHandler, trigger: hooks.trigger }, args)

  return [
    bindTool(readTool),
    bindTool(bashTool),
    bindTool(editTool),
    bindTool(writeTool),
    bindTool(grepTool),
    bindTool(findTool),
    bindTool(lsTool),
  ]
}
