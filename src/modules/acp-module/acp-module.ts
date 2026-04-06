import type { Module } from '../../agent.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../tool-registry-module/tool-registry-module.constants.ts'
import type { CapabilityRecord } from '../tool-registry-module/tool-registry-module.schemas.ts'
import { WORKFLOW_STATE_MODULE_SIGNAL_KEYS } from '../workflow-state-module/workflow-state-module.constants.ts'
import type { WorkflowState } from '../workflow-state-module/workflow-state-module.schemas.ts'
import { ACP_MODULE_EVENTS, ACP_MODULE_SIGNAL_KEYS } from './acp-module.constants.ts'
import {
  AcpAdvertisedCapabilitySchema,
  type AcpModuleState,
  AcpModuleStateSchema,
  AcpSessionSchema,
  CancelAcpSessionDetailSchema,
  OpenAcpSessionDetailSchema,
  SubmitAcpTurnDetailSchema,
} from './acp-module.schemas.ts'
import type { CreateAcpModuleOptions } from './acp-module.types.ts'

const toCapability = (record: CapabilityRecord) =>
  AcpAdvertisedCapabilitySchema.parse({
    id: record.id,
    title: record.name,
  })

/**
 * Creates the bounded ACP control-plane module.
 *
 * @public
 */
export const createAcpModule =
  ({
    stateSignalKey = ACP_MODULE_SIGNAL_KEYS.state,
    toolRegistrySignalKey = TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
    workflowStateSignalKey = WORKFLOW_STATE_MODULE_SIGNAL_KEYS.state,
    transport = 'stdio',
    maxSessions = 8,
  }: CreateAcpModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: AcpModuleStateSchema,
        value: {
          transport,
          advertisedCapabilities: [],
          sessions: [],
        },
        readOnly: false,
      })

    const publish = (next: AcpModuleState) => {
      const parsed = AcpModuleStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as AcpModuleState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: ACP_MODULE_EVENTS.acp_module_updated,
        detail: {
          transport: parsed.transport,
          capabilityCount: parsed.advertisedCapabilities.length,
          sessionCount: parsed.sessions.length,
        },
      })
    }

    const rebuildCapabilities = () => {
      const current = (stateSignal.get() ?? null) as AcpModuleState | null
      if (!current) return
      const registry = (signals.get(toolRegistrySignalKey)?.get() ?? []) as CapabilityRecord[]
      const workflow = (signals.get(workflowStateSignalKey)?.get() ?? null) as WorkflowState | null
      const workflowCapabilities = (workflow?.activeRoles ?? []).map((role) =>
        AcpAdvertisedCapabilitySchema.parse({
          id: `workflow:${role}`,
          title: `Workflow ${role}`,
        }),
      )
      publish({
        ...current,
        advertisedCapabilities: [...registry.slice(0, 6).map(toCapability), ...workflowCapabilities],
      })
    }

    signals.get(toolRegistrySignalKey)?.listen(() => rebuildCapabilities(), true)
    signals.get(workflowStateSignalKey)?.listen(() => rebuildCapabilities(), true)
    rebuildCapabilities()

    return {
      handlers: {
        [ACP_MODULE_EVENTS.acp_module_open_session](detail) {
          const parsed = OpenAcpSessionDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as AcpModuleState | null
          if (!current) return
          publish({
            ...current,
            sessions: [
              ...current.sessions.filter((session) => session.sessionId !== parsed.data.sessionId),
              AcpSessionSchema.parse({
                sessionId: parsed.data.sessionId,
                promptCount: 0,
                status: 'idle',
              }),
            ].slice(-maxSessions),
          })
        },
        [ACP_MODULE_EVENTS.acp_module_submit_turn](detail) {
          const parsed = SubmitAcpTurnDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as AcpModuleState | null
          if (!current) return
          publish({
            ...current,
            sessions: current.sessions.map((session) =>
              session.sessionId === parsed.data.sessionId
                ? AcpSessionSchema.parse({
                    ...session,
                    promptCount: session.promptCount + 1,
                    status: 'running',
                    lastPrompt: parsed.data.prompt,
                  })
                : session,
            ),
          })
        },
        [ACP_MODULE_EVENTS.acp_module_cancel_session](detail) {
          const parsed = CancelAcpSessionDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as AcpModuleState | null
          if (!current) return
          publish({
            ...current,
            sessions: current.sessions.map((session) =>
              session.sessionId === parsed.data.sessionId
                ? AcpSessionSchema.parse({ ...session, status: 'cancelled' })
                : session,
            ),
          })
        },
      },
    }
  }
