import { describe, expect, test } from 'bun:test'
import * as z from 'zod'

import { bSync, bThread } from '../behavioral.shared.ts'
import {
  createModuleRuntimeActor,
  MODULE_RUNTIME_DIAGNOSTIC_CODES,
  toModuleActorId,
  toModuleActorLocalEventType,
} from '../create-module-runtime-actor.ts'

const createOutboundEnvelope = ({ id, moduleId }: { id: string; moduleId: string }) => ({
  id,
  type: 'module:intent',
  source: {
    id: toModuleActorId({ moduleId }),
    kind: 'module' as const,
    moduleId,
  },
  target: {
    id: 'ui:controller',
    kind: 'ui' as const,
  },
  detail: {
    action: 'render',
    attempts: 1,
  },
  meta: {
    purpose: 'ui-sync',
    boundary: 'domain:node-local',
  },
})

const createInboundEnvelope = ({
  id,
  moduleId,
  source,
}: {
  id: string
  moduleId: string
  source?: { id: string; kind: 'module' | 'ui' | 'supervisor'; moduleId?: string }
}) => ({
  id,
  type: 'module:handoff',
  source: source ?? {
    id: 'supervisor:domain:node-local',
    kind: 'supervisor' as const,
  },
  target: {
    id: toModuleActorId({ moduleId }),
    kind: 'module' as const,
    moduleId,
  },
  detail: {
    approved: true,
  },
  meta: {
    purpose: 'grant-approved',
    boundary: 'domain:node-local',
  },
})

describe('createModuleRuntimeActor', () => {
  test('throws when moduleId is an empty string', () => {
    expect(() => createModuleRuntimeActor({ moduleId: '' })).toThrowError(/moduleId to be a non-empty string/)
  })

  test('rejects non-JSON local event detail values without throwing', () => {
    const runtime = createModuleRuntimeActor({
      authorityDomainId: 'domain:node-local',
      moduleId: 'planner',
    })

    const result = runtime.triggerLocalEvent({
      type: 'run',
      detail: {
        fn: () => 1,
      },
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected local event result.')
    }

    expect(result.code).toBe(MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidLocalEvent)
    expect(result.error).toContain('module local event rejected')
    expect(runtime.getLocalEventHistory()).toEqual([])
    expect(runtime.getValidationDiagnostics()).toContainEqual(
      expect.objectContaining({
        lane: 'local',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidLocalEvent,
      }),
    )
  })

  test('module-local blocking is isolated per module actor runtime', () => {
    const plannerRuntime = createModuleRuntimeActor({
      authorityDomainId: 'domain:node-local',
      moduleId: 'planner',
    })

    const executorRuntime = createModuleRuntimeActor({
      authorityDomainId: 'domain:node-local',
      moduleId: 'executor',
    })

    const blockedLocalType = toModuleActorLocalEventType({
      moduleId: 'planner',
      eventType: 'run',
    })

    plannerRuntime.addBThread(
      'blockPlannerRun',
      bThread(
        [
          bSync({
            block: {
              type: blockedLocalType,
              detailSchema: z.unknown(),
            },
          }),
        ],
        true,
      ),
    )

    const plannerResult = plannerRuntime.triggerLocalEvent({
      type: 'run',
      detail: { step: 1 },
    })
    const executorResult = executorRuntime.triggerLocalEvent({
      type: 'run',
      detail: { step: 1 },
    })

    expect(plannerResult.status).toBe('blocked')
    expect(executorResult.status).toBe('accepted')
    expect(plannerRuntime.getLocalEventHistory()).toEqual([])
    expect(executorRuntime.getLocalEventHistory()).toHaveLength(1)

    const latestPlannerDecision = plannerRuntime.getDecisionHistory().at(-1)
    expect(latestPlannerDecision).toEqual(
      expect.objectContaining({
        lane: 'local',
        decision: 'blocked',
        reason: 'blocked_by_module_frontier',
      }),
    )
  })

  test('emits outbound envelopes with module-owned source and queues them for supervisor observation', () => {
    const runtime = createModuleRuntimeActor({
      authorityDomainId: 'domain:node-local',
      moduleId: 'planner',
    })

    const envelope = createOutboundEnvelope({
      id: 'env-outbound-1',
      moduleId: 'planner',
    })

    const result = runtime.emitOutboundEnvelope(envelope)

    expect(result.status).toBe('emitted')
    expect(runtime.getOutboundEnvelopeHistory()).toEqual([envelope])
    expect(runtime.takeOutboundEnvelopes()).toEqual([envelope])
    expect(runtime.takeOutboundEnvelopes()).toEqual([])
  })

  test('rejects outbound envelopes whose source does not match the owning module actor', () => {
    const runtime = createModuleRuntimeActor({
      authorityDomainId: 'domain:node-local',
      moduleId: 'planner',
    })

    const result = runtime.emitOutboundEnvelope({
      ...createOutboundEnvelope({
        id: 'env-outbound-2',
        moduleId: 'planner',
      }),
      source: {
        id: toModuleActorId({ moduleId: 'executor' }),
        kind: 'module' as const,
        moduleId: 'executor',
      },
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected outbound result.')
    }

    expect(result.code).toBe(MODULE_RUNTIME_DIAGNOSTIC_CODES.outboundSourceMismatch)
    expect(runtime.getValidationDiagnostics()).toContainEqual(
      expect.objectContaining({
        lane: 'outbound',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.outboundSourceMismatch,
      }),
    )
  })

  test('accepts inbound envelopes targeted to the owning module actor', () => {
    const runtime = createModuleRuntimeActor({
      authorityDomainId: 'domain:node-local',
      moduleId: 'planner',
    })

    const acceptedResult = runtime.receiveInboundEnvelope(
      createInboundEnvelope({
        id: 'env-inbound-1',
        moduleId: 'planner',
      }),
    )

    expect(acceptedResult.status).toBe('received')
    expect(runtime.getInboundEnvelopeHistory()).toHaveLength(1)

    const acceptedModuleSource = runtime.receiveInboundEnvelope(
      createInboundEnvelope({
        id: 'env-inbound-2',
        moduleId: 'planner',
        source: {
          id: toModuleActorId({ moduleId: 'executor' }),
          kind: 'module',
          moduleId: 'executor',
        },
      }),
    )
    expect(acceptedModuleSource.status).toBe('received')

    const rejectedByTarget = runtime.receiveInboundEnvelope({
      ...createInboundEnvelope({
        id: 'env-inbound-3',
        moduleId: 'planner',
      }),
      target: {
        id: toModuleActorId({ moduleId: 'executor' }),
        kind: 'module' as const,
        moduleId: 'executor',
      },
    })

    expect(rejectedByTarget.status).toBe('rejected')
    if (rejectedByTarget.status !== 'rejected') {
      throw new Error('Expected rejected inbound result for mismatched target module.')
    }
    expect(rejectedByTarget.code).toBe(MODULE_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch)
  })
})
