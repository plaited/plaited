import { glob } from 'node:fs/promises'
import { isAbsolute, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { infer as Infer, ZodTypeAny } from 'zod'
import type { Disconnect } from '../behavioral.ts'
import { behavioral, bSync, bThread } from '../behavioral.ts'
import { isTypeOf } from '../utils.ts'
import { AGENT_CORE_EVENTS } from './agent.constants.ts'
import {
  FactoryResultSchema,
  GrepOutputSchema,
  type RequestBashDetail,
  RequestBashDetailSchema,
  type RequestDeleteFileDetail,
  RequestDeleteFileDetailSchema,
  type RequestGlobFilesDetail,
  RequestGlobFilesDetailSchema,
  type RequestGrepDetail,
  RequestGrepDetailSchema,
  type RequestPrimaryInferenceDetail,
  RequestPrimaryInferenceDetailSchema,
  type RequestReadFileDetail,
  RequestReadFileDetailSchema,
  type RequestTtsInferenceDetail,
  RequestTtsInferenceDetailSchema,
  type RequestVisionInferenceDetail,
  RequestVisionInferenceDetailSchema,
  type RequestWriteFileDetail,
  RequestWriteFileDetailSchema,
  UpdateFactoryModuleSchema,
} from './agent.schemas.ts'
import type { AgentHandle, CreateAgentOptions, SchemaViolationHandler, Signal, Signals } from './agent.types.ts'
import { useComputed } from './use-computed.ts'
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
  models,
  env = {},
  factories = [],
  restrictedTriggers = [],
  heartbeat,
}: CreateAgentOptions): Promise<AgentHandle> => {
  const { bThreads, trigger, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()
  const runtimeEnv = Object.entries({ ...process.env, ...env }).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value
    }
    return acc
  }, {})

  const restrictedTrigger = useRestrictedTrigger(
    ...restrictedTriggers,
    AGENT_CORE_EVENTS.set_signal,
    AGENT_CORE_EVENTS.heartbeat,
    AGENT_CORE_EVENTS.signal_schema_violation,
  )

  const disconnectSet = new Set<Disconnect>()

  const signalMap = new Map<string, Signal>()
  const computed = useComputed(disconnectSet, restrictedTrigger)

  const resolveWorkspacePath = (detail: string) => (isAbsolute(detail) ? detail : resolve(workspace, detail))
  const resolveCwdPath = (detail: string) => resolve(cwd, detail)

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
      disconnectSet,
      trigger: restrictedTrigger,
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
      signals,
      useSnapshot,
      computed,
    })
    threads && bThreads.set(threads)
    handlers && disconnectSet.add(useFeedback(handlers))
  }

  const createToolSignal = (timeout: number | undefined) => AbortSignal.timeout(timeout ?? DEFAULT_TOOL_TIMEOUT_MS)

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
            const path = resolveWorkspacePath(detail)
            return !path.startsWith(`${workspace}${sep}`)
          },
        }),
      ],
      true,
    ),
    onReadFile: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.read_file) return false
            const parsed = RequestReadFileDetailSchema.safeParse(detail)
            if (!parsed.success) return true
            const resolved = resolveCwdPath(parsed.data.input)
            return !resolved.startsWith(`${cwd}${sep}`)
          },
        }),
      ],
      true,
    ),
    onWriteFile: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.write_file) return false
            const parsed = RequestWriteFileDetailSchema.safeParse(detail)
            if (!parsed.success) return true
            const resolved = resolveCwdPath(parsed.data.input.path)
            return !resolved.startsWith(`${cwd}${sep}`)
          },
        }),
      ],
      true,
    ),
    onDeleteFile: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.delete_file) return false
            const parsed = RequestDeleteFileDetailSchema.safeParse(detail)
            if (!parsed.success) return true
            const resolved = resolveCwdPath(parsed.data.input)
            return !resolved.startsWith(`${cwd}${sep}`)
          },
        }),
      ],
      true,
    ),
    onGlob: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.glob_files) return false
            const parsed = RequestGlobFilesDetailSchema.safeParse(detail)
            if (!parsed.success) return true
            const { pattern, exclude = [] } = parsed.data.input
            return [pattern, ...exclude].some((entry) => entry.startsWith('/') || entry.includes('..'))
          },
        }),
      ],
      true,
    ),
    onGrep: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.grep) return false
            const parsed = RequestGrepDetailSchema.safeParse(detail)
            if (!parsed.success) return true
            if (!parsed.data.input.path) return false
            const resolved = resolveCwdPath(parsed.data.input.path)
            return !resolved.startsWith(`${cwd}${sep}`)
          },
        }),
      ],
      true,
    ),
    onBash: bThread(
      [
        bSync({
          block: ({ type, detail }) => {
            if (type !== AGENT_CORE_EVENTS.bash) return false
            const parsed = RequestBashDetailSchema.safeParse(detail)
            if (!parsed.success) return true
            const resolved = resolveWorkspacePath(parsed.data.input.path)
            return !resolved.startsWith(`${workspace}${sep}`)
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
    async [AGENT_CORE_EVENTS.request_inference_primary](detail: RequestPrimaryInferenceDetail) {
      const { input, signal } = RequestPrimaryInferenceDetailSchema.parse(detail)
      const output = await models.primary(input)
      signal.set?.({ input, output })
    },
    async [AGENT_CORE_EVENTS.request_inference_vision](detail: RequestVisionInferenceDetail) {
      const { input, signal } = RequestVisionInferenceDetailSchema.parse(detail)
      const output = await models.vision(input)
      signal.set?.({ input, output })
    },
    async [AGENT_CORE_EVENTS.request_inference_tts](detail: RequestTtsInferenceDetail) {
      const { input, signal } = RequestTtsInferenceDetailSchema.parse(detail)
      const output = await models.tts(input)
      signal.set?.({ input, output })
    },
    async [AGENT_CORE_EVENTS.update_factories](detail: string) {
      const modules = await import(pathToFileURL(resolveWorkspacePath(detail)).href)
      const { default: factory } = UpdateFactoryModuleSchema.parse(modules)
      const { threads, handlers } = FactoryResultSchema.parse(
        factory({
          trigger: restrictedTrigger,
          useSnapshot,
          signals,
          computed,
        }),
      )
      threads && bThreads.set(threads)
      handlers && disconnectSet.add(useFeedback(handlers))
    },
    async [AGENT_CORE_EVENTS.read_file](detail: RequestReadFileDetail) {
      const { input, signal } = RequestReadFileDetailSchema.parse(detail)
      const resolved = resolveCwdPath(input)
      signal.set?.({ input, output: Bun.file(resolved) })
    },
    async [AGENT_CORE_EVENTS.delete_file](detail: RequestDeleteFileDetail) {
      const { input, signal } = RequestDeleteFileDetailSchema.parse(detail)
      const resolved = resolveCwdPath(input)
      await Bun.file(resolved).delete()
      signal.set?.({ input, output: true })
    },
    async [AGENT_CORE_EVENTS.write_file](detail: RequestWriteFileDetail) {
      const { input, signal } = RequestWriteFileDetailSchema.parse(detail)
      const resolved = resolveCwdPath(input.path)
      const output = await Bun.write(resolved, input.content)
      signal.set?.({ input, output })
    },
    async [AGENT_CORE_EVENTS.glob_files](detail: RequestGlobFilesDetail) {
      const { input, signal } = RequestGlobFilesDetailSchema.parse(detail)
      const output = await Array.fromAsync(glob(input.pattern, { exclude: input.exclude, cwd }))
      signal.set?.({ input, output })
    },
    async [AGENT_CORE_EVENTS.grep](detail: RequestGrepDetail) {
      const { input, signal } = RequestGrepDetailSchema.parse(detail)
      const { timeout, ...request } = input
      const proc = Bun.spawn(['bun', fileURLToPath(import.meta.resolve('./grep-worker.ts')), JSON.stringify(request)], {
        cwd,
        env: runtimeEnv,
        signal: createToolSignal(timeout),
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      const output =
        exitCode === 0
          ? GrepOutputSchema.parse({
              status: 'completed',
              ...JSON.parse(stdout),
              exitCode: 0,
            })
          : GrepOutputSchema.parse({
              status: 'failed',
              error: stderr.trim() || `grep worker exited with code ${exitCode}`,
              exitCode,
              stderr: stderr.trim() || undefined,
            })
      signal.set?.({ input, output })
    },
    async [AGENT_CORE_EVENTS.bash](detail: RequestBashDetail) {
      const { input, signal } = RequestBashDetailSchema.parse(detail)
      const proc = Bun.spawn(['bun', resolveWorkspacePath(input.path), ...input.args], {
        cwd,
        env: runtimeEnv,
        signal: createToolSignal(input.timeout),
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      signal.set?.(
        exitCode === 0
          ? {
              input,
              output: {
                status: 'completed',
                output: stdout,
                exitCode: 0,
              },
            }
          : {
              input,
              output: {
                status: 'failed',
                error: stderr.trim() || `Command exited with code ${exitCode}`,
                exitCode,
                stderr: stderr.trim() || undefined,
              },
            },
      )
    },
  })

  return {
    trigger: restrictedTrigger,
    useSnapshot,
  }
}
