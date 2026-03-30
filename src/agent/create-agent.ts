import { behavioral } from '../behavioral/behavioral.ts'
import { AGENT_CORE_EVENTS } from './agent.constants.ts'
import type { AgentHandle, CreateAgentOptions } from './agent.types.ts'

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000

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
  })

  for (const factory of factories) {
    const installed = await factory({ trigger, useSnapshot })
    if (installed.threads && Object.keys(installed.threads).length > 0) {
      bThreads.set(installed.threads)
    }
    if (installed.handlers) {
      useFeedback(installed.handlers)
    }
  }

  return {
    restrictedTrigger: useRestrictedTrigger(...restrictedTriggers),
    useSnapshot,
  }
}
