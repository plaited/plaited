import { behavioral } from '../behavioral/behavioral.ts'
import { AGENT_CORE_EVENTS } from './agent.constants.ts'
import {
  FactoriesUpdatedDetailSchema,
  UpdateFactoriesDetailSchema,
  UpdateFactoriesErrorDetailSchema,
} from './agent.schemas.ts'
import type { AgentHandle, CreateAgentOptions } from './agent.types.ts'

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000

const installFactory = async ({
  factory,
  bThreads,
  trigger,
  useFeedback,
  useSnapshot,
}: {
  factory: NonNullable<CreateAgentOptions['factories']>[number]
  bThreads: ReturnType<typeof behavioral>['bThreads']
  trigger: ReturnType<typeof behavioral>['trigger']
  useFeedback: ReturnType<typeof behavioral>['useFeedback']
  useSnapshot: ReturnType<typeof behavioral>['useSnapshot']
}) => {
  const installed = await factory({ trigger, useSnapshot })
  if (installed.threads && Object.keys(installed.threads).length > 0) {
    bThreads.set(installed.threads)
  }
  if (installed.handlers) {
    useFeedback(installed.handlers)
  }
}

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
  factories = [],
  restrictedTriggers = [],
  heartbeat,
}: CreateAgentOptions): Promise<AgentHandle> => {
  const { bThreads, trigger, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()

  const heartbeatIntervalMs = heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
  const heartbeatTimer = setInterval(() => {
    trigger({
      type: AGENT_CORE_EVENTS.agent_heartbeat,
      detail: { intervalMs: heartbeatIntervalMs },
    })
  }, heartbeatIntervalMs)

  useFeedback({
    [AGENT_CORE_EVENTS.agent_disconnect]() {
      clearInterval(heartbeatTimer)
    },
    async [AGENT_CORE_EVENTS.update_factories](detail: unknown) {
      const parsed = UpdateFactoriesDetailSchema.parse(detail)

      try {
        const imported = await import(parsed.module)
        const factory = imported.default

        if (typeof factory !== 'function') {
          throw new Error('Factory module default export must be a function')
        }

        await installFactory({
          factory,
          bThreads,
          trigger,
          useFeedback,
          useSnapshot,
        })

        trigger({
          type: AGENT_CORE_EVENTS.factories_updated,
          detail: FactoriesUpdatedDetailSchema.parse({ module: parsed.module }),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        trigger({
          type: AGENT_CORE_EVENTS.update_factories_error,
          detail: UpdateFactoriesErrorDetailSchema.parse({
            module: parsed.module,
            error: message,
          }),
        })
      }
    },
  })

  for (const factory of factories) {
    await installFactory({
      factory,
      bThreads,
      trigger,
      useFeedback,
      useSnapshot,
    })
  }

  return {
    restrictedTrigger: useRestrictedTrigger(...restrictedTriggers),
    useSnapshot,
  }
}
