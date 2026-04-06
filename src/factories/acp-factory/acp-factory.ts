import type { Factory } from '../../agent.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../tool-registry-factory/tool-registry-factory.constants.ts'
import type { CapabilityRecord } from '../tool-registry-factory/tool-registry-factory.schemas.ts'
import { WORKFLOW_STATE_FACTORY_SIGNAL_KEYS } from '../workflow-state-factory/workflow-state-factory.constants.ts'
import type { WorkflowState } from '../workflow-state-factory/workflow-state-factory.schemas.ts'
import { ACP_FACTORY_EVENTS, ACP_FACTORY_SIGNAL_KEYS } from './acp-factory.constants.ts'
import {
  AcpAdvertisedCapabilitySchema,
  type AcpFactoryState,
  AcpFactoryStateSchema,
  AcpSessionSchema,
  CancelAcpSessionDetailSchema,
  OpenAcpSessionDetailSchema,
  SubmitAcpTurnDetailSchema,
} from './acp-factory.schemas.ts'
import type { CreateAcpFactoryOptions } from './acp-factory.types.ts'

const toCapability = (record: CapabilityRecord) =>
  AcpAdvertisedCapabilitySchema.parse({
    id: record.id,
    title: record.name,
  })

/**
 * Creates the bounded ACP control-plane factory.
 *
 * @public
 */
export const createAcpFactory =
  ({
    stateSignalKey = ACP_FACTORY_SIGNAL_KEYS.state,
    toolRegistrySignalKey = TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
    workflowStateSignalKey = WORKFLOW_STATE_FACTORY_SIGNAL_KEYS.state,
    transport = 'stdio',
    maxSessions = 8,
  }: CreateAcpFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: AcpFactoryStateSchema,
        value: {
          transport,
          advertisedCapabilities: [],
          sessions: [],
        },
        readOnly: false,
      })

    const publish = (next: AcpFactoryState) => {
      const parsed = AcpFactoryStateSchema.parse(next)
      const current = (stateSignal.get() ?? null) as AcpFactoryState | null
      if (current && JSON.stringify(current) === JSON.stringify(parsed)) return
      stateSignal.set?.(parsed)
      trigger({
        type: ACP_FACTORY_EVENTS.acp_factory_updated,
        detail: {
          transport: parsed.transport,
          capabilityCount: parsed.advertisedCapabilities.length,
          sessionCount: parsed.sessions.length,
        },
      })
    }

    const rebuildCapabilities = () => {
      const current = (stateSignal.get() ?? null) as AcpFactoryState | null
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
        [ACP_FACTORY_EVENTS.acp_factory_open_session](detail) {
          const parsed = OpenAcpSessionDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as AcpFactoryState | null
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
        [ACP_FACTORY_EVENTS.acp_factory_submit_turn](detail) {
          const parsed = SubmitAcpTurnDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as AcpFactoryState | null
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
        [ACP_FACTORY_EVENTS.acp_factory_cancel_session](detail) {
          const parsed = CancelAcpSessionDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as AcpFactoryState | null
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
