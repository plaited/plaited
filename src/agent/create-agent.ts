import { isAbsolute, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { $ } from 'bun'
import type { infer as Infer, ZodTypeAny } from 'zod'
import type { Disconnect } from '../behavioral.ts'
import { behavioral, bSync, bThread } from '../behavioral.ts'
import { isTypeOf } from '../utils.ts'
import { AGENT_CORE_EVENTS } from './agent.constants.ts'
import { AgentToolResultDetailSchema, FactoryResultSchema, UpdateFactoryModuleSchema } from './agent.schemas.ts'
import type { AgentHandle, CreateAgentOptions, SchemaViolationHandler, Signal, Signals } from './agent.types.ts'
import { BashConfigSchema } from './crud.schemas.ts'
import { editFile, grep, listFiles, readFile, writeFile } from './crud.ts'
import { truncateTail } from './truncate.ts'
import { useSignal } from './use-signal.ts'

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000

const DEFAULT_TOOL_TIMEOUT_MS = 120_000

/**
 * Creates the minimal agent core around the behavioral engine.
 *
 * @remarks
 * The core owns only:
 * - behavioral engine setup
 * - restricted trigger boundary
 * - heartbeat pulse
 * - disconnect cleanup
 * - installation of executable factories
 *
 * Everything richer should be layered on through factories.
 *
 * @public
 */
export const createAgent = async ({
  id: _id,
  cwd,
  workspace,
  env = {},
  factories = [],
  restrictedTriggers = [],
  heartbeat,
}: CreateAgentOptions): Promise<AgentHandle> => {
  const { bThreads, trigger, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()

  const restrictedTrigger = useRestrictedTrigger(
    ...restrictedTriggers,
    AGENT_CORE_EVENTS.set_signal,
    AGENT_CORE_EVENTS.heartbeat,
    AGENT_CORE_EVENTS.signal_schema_violation,
  )

  const disconnectSet = new Set<Disconnect>()

  const signalMap = new Map<string, Signal>()

  const resolveFactoryPath = (detail: string) => (isAbsolute(detail) ? detail : resolve(workspace, detail))

  const onSchemaViolation: SchemaViolationHandler = (detail) =>
    trigger({ type: AGENT_CORE_EVENTS.signal_schema_violation, detail })

  const setSignals = <TSchema extends ZodTypeAny>({
    key,
    schema,
    value,
    readOnly,
  }: {
    key: string
    schema: TSchema
    value?: Infer<TSchema>
    readOnly: boolean
  }) => {
    const signal = useSignal({
      key,
      schema,
      value,
      onSchemaViolation,
    })
    trigger({
      type: AGENT_CORE_EVENTS.set_signal,
      detail: {
        key,
        signal,
        readOnly,
      },
    })
    return signal
  }

  const signals: Signals = {
    set: setSignals,
    get: signalMap.get,
    has: signalMap.has,
  }
  for (const factory of factories) {
    const { threads, handlers } = factory({
      trigger: restrictedTrigger,
      disconnectSet,
      signals,
      useSnapshot,
    })
    threads && bThreads.set(threads)
    handlers && disconnectSet.add(useFeedback(handlers))
  }

  const createToolSignal = (timeout: number | undefined) => AbortSignal.timeout(timeout ?? DEFAULT_TOOL_TIMEOUT_MS)
  const createPassiveSignal = () => new AbortController().signal

  const emitToolResult = ({ name, output }: { name: string; output: unknown }) => {
    trigger({
      type: AGENT_CORE_EVENTS.agent_tool_result,
      detail: AgentToolResultDetailSchema.parse({
        result: {
          name,
          status: 'completed',
          output,
        },
      }),
    })
  }

  const heartbeatIntervalMs = heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
  const heartbeatTimer = setInterval(() => {
    trigger({
      type: AGENT_CORE_EVENTS.heartbeat,
      detail: { intervalMs: heartbeatIntervalMs },
    })
  }, heartbeatIntervalMs)

  bThreads.set({
    onSignalSet: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.set_signal) return false
            return signalMap.has(detail.key)
          },
        }),
      ],
      true,
    ),
    onUpdateFactories: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.update_factories) return false
            if (!isTypeOf<string>(detail, 'string')) return true
            if (!/\.tsx?$/.test(detail)) return true
            const path = resolveFactoryPath(detail)
            return !path.startsWith(`${workspace}${sep}`)
          },
        }),
      ],
      true,
    ),
  })

  useFeedback({
    [AGENT_CORE_EVENTS.agent_disconnect]() {
      clearInterval(heartbeatTimer)
      for (const disconnect of disconnectSet) {
        void disconnect()
      }
      disconnectSet.clear()
    },
    [AGENT_CORE_EVENTS.set_signal]({ key, signal, readOnly }: { key: string; signal: Signal; readOnly: boolean }) {
      const { set, ...rest } = signal
      !readOnly && Object.assign(rest, { set })
      signalMap.set(key, rest)
    },
    async [AGENT_CORE_EVENTS.update_factories](detail: string) {
      const modules = await import(pathToFileURL(resolveFactoryPath(detail)).href)
      const { default: factory } = UpdateFactoryModuleSchema.parse(modules)
      const { threads, handlers } = FactoryResultSchema.parse(
        factory({
          trigger: restrictedTrigger,
          useSnapshot,
          disconnectSet,
          signals,
        }),
      )
      threads && bThreads.set(threads)
      handlers && disconnectSet.add(useFeedback(handlers))
    },
    async [AGENT_CORE_EVENTS.read_file](detail: Parameters<typeof readFile>[0]) {
      const output = await readFile(detail, {
        env,
        cwd,
        signal: createPassiveSignal(),
      })
      emitToolResult({ name: AGENT_CORE_EVENTS.read_file, output })
    },
    async [AGENT_CORE_EVENTS.write_file](detail: Parameters<typeof writeFile>[0]) {
      const output = await writeFile(detail, { env, cwd, signal: createPassiveSignal() })
      emitToolResult({ name: AGENT_CORE_EVENTS.write_file, output })
    },
    async [AGENT_CORE_EVENTS.edit_file](detail: Parameters<typeof editFile>[0]) {
      const output = await editFile(detail, { env, cwd, signal: createPassiveSignal() })
      emitToolResult({ name: AGENT_CORE_EVENTS.edit_file, output })
    },
    async [AGENT_CORE_EVENTS.list_files](detail: Parameters<typeof listFiles>[0]) {
      const output = await listFiles(detail, { env, cwd, signal: createPassiveSignal() })
      emitToolResult({ name: AGENT_CORE_EVENTS.list_files, output })
    },
    async [AGENT_CORE_EVENTS.grep]({ timeout, ...detail }: Parameters<typeof grep>[0]) {
      const output = await grep({ ...detail, timeout }, { env, cwd, signal: createToolSignal(timeout) })
      emitToolResult({ name: AGENT_CORE_EVENTS.grep, output })
    },
    async [AGENT_CORE_EVENTS.bash](detail: { command: string; timeout?: number }) {
      const { command, timeout } = BashConfigSchema.parse(detail)
      const signal = createToolSignal(timeout)
      signal.throwIfAborted()
      const result = await $`${{ raw: command }}`.cwd(cwd).env(env).nothrow().quiet()
      signal.throwIfAborted()
      if (result.exitCode !== 0) {
        throw new Error(result.stderr.toString().trim() || `Command exited with code ${result.exitCode}`)
      }
      emitToolResult({
        name: AGENT_CORE_EVENTS.bash,
        output: truncateTail(result.stdout.toString().trim()),
      })
    },
  })

  return {
    trigger: restrictedTrigger,
    useSnapshot,
  }
}
