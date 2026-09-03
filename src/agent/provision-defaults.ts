import bashTool from '../tools/bash.ts'
import type { BinaryProvision } from '../tools/binary.ts'
import binaryTool from '../tools/binary.ts'
import editTool from '../tools/edit.ts'
import findTool from '../tools/find.ts'
import grepTool from '../tools/grep.ts'
import lsTool from '../tools/ls.ts'
import readTool from '../tools/read.ts'
import type { CwdProvision, JsonObject, ToolArgs } from '../tools/tool.types.ts'
import writeTool from '../tools/write.ts'
import type { ToolDescriptor } from './define-tool.ts'
import { defineTool } from './define-tool.ts'
import type { AgentHooks } from './kernel.ts'

/**
 * Provision-time scoping applied to every tool in the pack.
 *
 * - `cwd` — the space's working directory: bash spawns there; file tools
 *   resolve relative paths against it (grep/find default their search root
 *   to it). Absolute model-supplied paths still win — path sandboxing is a
 *   Phase 5 policy concern (guards / run-composition), not a schema one.
 */
export type ProvisionOptions = CwdProvision & BinaryProvision

/**
 * Provision the default tool pack into the given behavioral hooks.
 *
 * Wires all seven core tools (read, bash, edit, write, grep, find, ls) by
 * calling `defineTool` with the frozen `ToolArgs` from `src/tools/`. When
 * `options.cwd` is given, every tool's `run` is composed to execute within
 * that directory — the pack's data stays pure, the provisioner does the
 * composition.
 *
 * @param hooks - Behavioral hooks providing `addHandler`, `addThread`, and
 *   `trigger` for tool registration.
 * @param options - Provision-time scoping (cwd, maxBytes) applied to every tool.
 * @returns An array of registered tool descriptors.
 */
export const provisionDefaults = (hooks: AgentHooks, options?: ProvisionOptions): ToolDescriptor[] => {
  const bindTool = (args: ToolArgs): ToolDescriptor =>
    defineTool(args)({ addHandler: hooks.addHandler, trigger: hooks.trigger, addThread: hooks.addThread })

  const bind = (tool: ToolArgs): ToolDescriptor =>
    options?.cwd === undefined
      ? bindTool(tool)
      : bindTool({
          ...tool,
          run: (input) => tool.run({ ...(input as JsonObject), cwd: options.cwd }),
        })

  const bindBinary = (tool: ToolArgs): ToolDescriptor =>
    options?.cwd === undefined && options?.maxBytes === undefined
      ? bindTool(tool)
      : bindTool({
          ...tool,
          run: (input) =>
            tool.run({
              ...input,
              ...(options?.cwd !== undefined && { cwd: options.cwd }),
              ...(options?.maxBytes !== undefined && { maxBytes: options.maxBytes }),
            }),
        })

  return [
    bind(readTool),
    bind(bashTool),
    bind(editTool),
    bind(writeTool),
    bind(grepTool),
    bind(findTool),
    bind(lsTool),
    bindBinary(binaryTool),
  ]
}
