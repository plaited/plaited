import * as z from 'zod'

import { SNAPSHOT_MESSAGE_KINDS } from './behavioral.constants.ts'
import { type ActorEnvelope, ActorEnvelopeSchema, type SnapshotMessage } from './behavioral.schemas.ts'
import { bSync, bThread } from './behavioral.shared.ts'
import { behavioral } from './behavioral.ts'
import type { BPEvent, SnapshotListener, UseSnapshot } from './behavioral.types.ts'

const DEFAULT_AUTHORITY_DOMAIN_ID = 'node-local'
const ACTOR_DEFINITION_IDENTIFIER = 'plaited.actor.definition'

const AuthorityDomainIdSchema = z.string().min(1)
const ModuleIdSchema = z.string().min(1)
const DispatchIdSchema = z.string().min(1)
const LocalEventInputSchema = z.object({
  type: z.string().min(1),
  detail: z.json().optional(),
})

const ModuleRuntimeLocalIngressDetailSchema = z.object({
  dispatchId: DispatchIdSchema,
  moduleId: ModuleIdSchema,
  localEventType: z.string().min(1),
  event: LocalEventInputSchema,
})

type ModuleRuntimeLocalIngressDetail = z.infer<typeof ModuleRuntimeLocalIngressDetailSchema>

const ModuleRuntimeEnvelopeIngressDetailSchema = z.object({
  dispatchId: DispatchIdSchema,
  moduleId: ModuleIdSchema,
  envelope: ActorEnvelopeSchema,
})

type ModuleRuntimeEnvelopeIngressDetail = z.infer<typeof ModuleRuntimeEnvelopeIngressDetailSchema>

const ModuleRuntimeEnvelopeEventDetailSchema = z.object({
  dispatchId: DispatchIdSchema,
  envelope: ActorEnvelopeSchema,
})

type ModuleRuntimeEnvelopeEventPayload = z.infer<typeof ModuleRuntimeEnvelopeEventDetailSchema>

export const MODULE_RUNTIME_DIAGNOSTIC_CODES = {
  invalidLocalEvent: 'invalid_local_event',
  invalidOutboundEnvelope: 'invalid_outbound_envelope',
  invalidInboundEnvelope: 'invalid_inbound_envelope',
  outboundSourceMismatch: 'outbound_source_mismatch',
  inboundTargetMismatch: 'inbound_target_mismatch',
} as const

const MODULE_RUNTIME_DECISION_REASONS = {
  passThrough: 'pass_through',
  blockedByModuleFrontier: 'blocked_by_module_frontier',
} as const

type ModuleRuntimeLane = 'local' | 'outbound' | 'inbound'

type ModuleRuntimeDiagnosticCode =
  (typeof MODULE_RUNTIME_DIAGNOSTIC_CODES)[keyof typeof MODULE_RUNTIME_DIAGNOSTIC_CODES]

type ModuleRuntimeDecisionReason =
  | (typeof MODULE_RUNTIME_DECISION_REASONS)[keyof typeof MODULE_RUNTIME_DECISION_REASONS]
  | ModuleRuntimeDiagnosticCode

export type CreateModuleRuntimeActorOptions = {
  authorityDomainId?: string
  moduleId: string
}

export type DefineActorOptions = {
  id: string
  setup?: (runtime: ModuleRuntimeActor) => void | Promise<void>
}

export type ModuleRuntimeLocalEventRecord = {
  timestamp: number
  scopedType: string
  event: BPEvent
}

export type ModuleRuntimeValidationDiagnostic = {
  kind: 'validation'
  lane: ModuleRuntimeLane
  timestamp: number
  authorityDomainId: string
  moduleId: string
  code: ModuleRuntimeDiagnosticCode
  error: string
}

export type ModuleRuntimeDecisionRecord = {
  lane: ModuleRuntimeLane
  decision: 'approved' | 'blocked' | 'rejected'
  reason: ModuleRuntimeDecisionReason
  timestamp: number
  authorityDomainId: string
  moduleId: string
  localEventType?: string
  envelopeId?: string | null
}

export type ModuleRuntimeLocalEventResult =
  | {
      status: 'accepted'
      event: BPEvent
      scopedType: string
    }
  | {
      status: 'blocked'
      event: BPEvent
      scopedType: string
      reason: (typeof MODULE_RUNTIME_DECISION_REASONS)['blockedByModuleFrontier']
    }
  | {
      status: 'rejected'
      code: (typeof MODULE_RUNTIME_DIAGNOSTIC_CODES)['invalidLocalEvent']
      error: string
    }

export type ModuleRuntimeOutboundEnvelopeResult =
  | {
      status: 'emitted'
      envelope: ActorEnvelope
    }
  | {
      status: 'blocked'
      envelope: ActorEnvelope
      reason: (typeof MODULE_RUNTIME_DECISION_REASONS)['blockedByModuleFrontier']
    }
  | {
      status: 'rejected'
      code:
        | (typeof MODULE_RUNTIME_DIAGNOSTIC_CODES)['invalidOutboundEnvelope']
        | (typeof MODULE_RUNTIME_DIAGNOSTIC_CODES)['outboundSourceMismatch']
      error: string
    }

export type ModuleRuntimeInboundEnvelopeResult =
  | {
      status: 'received'
      envelope: ActorEnvelope
    }
  | {
      status: 'blocked'
      envelope: ActorEnvelope
      reason: (typeof MODULE_RUNTIME_DECISION_REASONS)['blockedByModuleFrontier']
    }
  | {
      status: 'rejected'
      code:
        | (typeof MODULE_RUNTIME_DIAGNOSTIC_CODES)['invalidInboundEnvelope']
        | (typeof MODULE_RUNTIME_DIAGNOSTIC_CODES)['inboundTargetMismatch']
      error: string
    }

const cloneSnapshots = (snapshots: SnapshotMessage[]) => structuredClone(snapshots)

const cloneLocalEventHistory = (history: ModuleRuntimeLocalEventRecord[]) => structuredClone(history)

const cloneEnvelopeHistory = (history: ActorEnvelope[]) => structuredClone(history)

const cloneValidationDiagnostics = (diagnostics: ModuleRuntimeValidationDiagnostic[]) => structuredClone(diagnostics)

const cloneDecisionHistory = (decisions: ModuleRuntimeDecisionRecord[]) => structuredClone(decisions)

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

const resolveAuthorityDomainId = (authorityDomainId?: string) => {
  if (authorityDomainId === undefined) {
    return DEFAULT_AUTHORITY_DOMAIN_ID
  }

  try {
    return AuthorityDomainIdSchema.parse(authorityDomainId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('createModuleRuntimeActor requires authorityDomainId to be a non-empty string when provided.')
    }

    throw error
  }
}

const resolveModuleId = (moduleId: string) => {
  try {
    return ModuleIdSchema.parse(moduleId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('createModuleRuntimeActor requires moduleId to be a non-empty string.')
    }

    throw error
  }
}

const matchesDispatchId = (detail: unknown, dispatchId: string) => {
  if (typeof detail !== 'object' || detail === null || !('dispatchId' in detail)) {
    return false
  }

  return (detail as { dispatchId?: unknown }).dispatchId === dispatchId
}

const hasSelectedTriggerBid = ({
  snapshots,
  startIndex,
  eventType,
  dispatchId,
}: {
  snapshots: SnapshotMessage[]
  startIndex: number
  eventType: string
  dispatchId?: string
}) => {
  const length = snapshots.length
  for (let i = startIndex; i < length; i++) {
    const snapshot = snapshots[i]!
    if (snapshot.kind !== SNAPSHOT_MESSAGE_KINDS.selection) {
      continue
    }

    const selectedBid = snapshot.bids.find((bid) => {
      if (!bid.selected || bid.source !== 'trigger' || bid.type !== eventType) {
        return false
      }

      if (dispatchId === undefined) {
        return true
      }

      return matchesDispatchId(bid.detail, dispatchId)
    })

    if (selectedBid) {
      return selectedBid
    }
  }

  return null
}

const toErrorSnapshotId = ({
  authorityDomainId,
  moduleId,
  code,
}: {
  authorityDomainId: string
  moduleId: string
  code: ModuleRuntimeDiagnosticCode
}) => `${authorityDomainId}:module:${moduleId}:${code}`

const toModuleLocalIngressEventType = ({ moduleId }: { moduleId: string }) => `module:${moduleId}:ingress_local_event`

const toModuleOutboundIngressEventType = ({ moduleId }: { moduleId: string }) =>
  `module:${moduleId}:ingress_outbound_envelope`

const toModuleInboundIngressEventType = ({ moduleId }: { moduleId: string }) =>
  `module:${moduleId}:ingress_inbound_envelope`

export const toModuleActorId = ({ moduleId }: { moduleId: string }) => `module:${moduleId}`

export const toModuleActorLocalEventType = ({ moduleId, eventType }: { moduleId: string; eventType: string }) =>
  `module:${moduleId}:local:${eventType}`

export const toModuleActorOutboundEnvelopeEventType = ({ moduleId }: { moduleId: string }) =>
  `module:${moduleId}:outbound_envelope`

export const toModuleActorInboundEnvelopeEventType = ({ moduleId }: { moduleId: string }) =>
  `module:${moduleId}:inbound_envelope`

export const createModuleRuntimeActor = (options: CreateModuleRuntimeActorOptions) => {
  const authorityDomainId = resolveAuthorityDomainId(options.authorityDomainId)
  const moduleId = resolveModuleId(options.moduleId)
  const moduleActorId = toModuleActorId({ moduleId })

  const localIngressEventType = toModuleLocalIngressEventType({ moduleId })
  const outboundIngressEventType = toModuleOutboundIngressEventType({ moduleId })
  const inboundIngressEventType = toModuleInboundIngressEventType({ moduleId })

  const outboundEventType = toModuleActorOutboundEnvelopeEventType({ moduleId })
  const inboundEventType = toModuleActorInboundEnvelopeEventType({ moduleId })

  const snapshots: SnapshotMessage[] = []
  const localEventHistory: ModuleRuntimeLocalEventRecord[] = []
  const outboundEnvelopeHistory: ActorEnvelope[] = []
  const outboundEnvelopeQueue: ActorEnvelope[] = []
  const inboundEnvelopeHistory: ActorEnvelope[] = []
  const validationDiagnostics: ModuleRuntimeValidationDiagnostic[] = []
  const decisions: ModuleRuntimeDecisionRecord[] = []

  let dispatchSequence = 0
  const nextDispatchId = (lane: ModuleRuntimeLane) => {
    dispatchSequence += 1
    return `${moduleId}:${lane}:${dispatchSequence}`
  }

  const { addBThread, addBThreads, reportSnapshot, trigger, useFeedback, useSnapshot } = behavioral()

  addBThreads({
    moduleLocalIngress: bThread(
      [
        bSync({
          waitFor: {
            type: localIngressEventType,
            sourceSchema: z.literal('trigger'),
            detailSchema: ModuleRuntimeLocalIngressDetailSchema,
          },
        }),
      ],
      true,
    ),
    moduleOutboundIngress: bThread(
      [
        bSync({
          waitFor: {
            type: outboundIngressEventType,
            sourceSchema: z.literal('trigger'),
            detailSchema: ModuleRuntimeEnvelopeIngressDetailSchema,
          },
        }),
      ],
      true,
    ),
    moduleInboundIngress: bThread(
      [
        bSync({
          waitFor: {
            type: inboundIngressEventType,
            sourceSchema: z.literal('trigger'),
            detailSchema: ModuleRuntimeEnvelopeIngressDetailSchema,
          },
        }),
      ],
      true,
    ),
  })

  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })

  useFeedback({
    [localIngressEventType](detail: ModuleRuntimeLocalIngressDetail) {
      const parsedDetail = ModuleRuntimeLocalIngressDetailSchema.parse(detail)

      trigger({
        type: parsedDetail.localEventType,
        detail: parsedDetail.event.detail,
      })
    },
    [outboundIngressEventType](detail: ModuleRuntimeEnvelopeIngressDetail) {
      const parsedDetail = ModuleRuntimeEnvelopeIngressDetailSchema.parse(detail)

      const eventDetail = ModuleRuntimeEnvelopeEventDetailSchema.parse({
        dispatchId: parsedDetail.dispatchId,
        envelope: parsedDetail.envelope,
      })

      trigger({
        type: outboundEventType,
        detail: eventDetail,
      })
    },
    [inboundIngressEventType](detail: ModuleRuntimeEnvelopeIngressDetail) {
      const parsedDetail = ModuleRuntimeEnvelopeIngressDetailSchema.parse(detail)

      const eventDetail = ModuleRuntimeEnvelopeEventDetailSchema.parse({
        dispatchId: parsedDetail.dispatchId,
        envelope: parsedDetail.envelope,
      })

      trigger({
        type: inboundEventType,
        detail: eventDetail,
      })
    },
  })

  const addValidationDiagnostic = ({
    lane,
    code,
    error,
  }: {
    lane: ModuleRuntimeLane
    code: ModuleRuntimeDiagnosticCode
    error: string
  }) => {
    const diagnostic: ModuleRuntimeValidationDiagnostic = {
      kind: 'validation',
      lane,
      timestamp: Date.now(),
      authorityDomainId,
      moduleId,
      code,
      error,
    }

    validationDiagnostics.push(diagnostic)

    reportSnapshot({
      kind: SNAPSHOT_MESSAGE_KINDS.extension_error,
      id: toErrorSnapshotId({
        authorityDomainId,
        moduleId,
        code,
      }),
      error,
    })
  }

  const addDecision = ({
    lane,
    decision,
    reason,
    localEventType,
    envelopeId,
  }: {
    lane: ModuleRuntimeLane
    decision: ModuleRuntimeDecisionRecord['decision']
    reason: ModuleRuntimeDecisionReason
    localEventType?: string
    envelopeId?: string | null
  }) => {
    decisions.push({
      lane,
      decision,
      reason,
      timestamp: Date.now(),
      authorityDomainId,
      moduleId,
      ...(localEventType !== undefined && { localEventType }),
      ...(envelopeId !== undefined && { envelopeId }),
    })
  }

  const triggerLocalEvent = (event: unknown): ModuleRuntimeLocalEventResult => {
    let parsedEvent: z.infer<typeof LocalEventInputSchema>
    try {
      parsedEvent = LocalEventInputSchema.parse(event)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = `module local event rejected: ${formatValidationError(error)}`
      addValidationDiagnostic({
        lane: 'local',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidLocalEvent,
        error: message,
      })
      addDecision({
        lane: 'local',
        decision: 'rejected',
        reason: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidLocalEvent,
      })

      return {
        status: 'rejected',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidLocalEvent,
        error: message,
      }
    }

    const dispatchId = nextDispatchId('local')
    const scopedType = toModuleActorLocalEventType({
      moduleId,
      eventType: parsedEvent.type,
    })

    const snapshotStart = snapshots.length

    trigger({
      type: localIngressEventType,
      detail: ModuleRuntimeLocalIngressDetailSchema.parse({
        dispatchId,
        moduleId,
        localEventType: scopedType,
        event: parsedEvent,
      }),
    })

    const ingressSelected = hasSelectedTriggerBid({
      snapshots,
      startIndex: snapshotStart,
      eventType: localIngressEventType,
      dispatchId,
    })
    const localSelected = hasSelectedTriggerBid({
      snapshots,
      startIndex: snapshotStart,
      eventType: scopedType,
    })

    if (ingressSelected && localSelected) {
      localEventHistory.push({
        timestamp: Date.now(),
        scopedType,
        event: structuredClone(parsedEvent),
      })

      addDecision({
        lane: 'local',
        decision: 'approved',
        reason: MODULE_RUNTIME_DECISION_REASONS.passThrough,
        localEventType: scopedType,
      })

      return {
        status: 'accepted',
        event: parsedEvent,
        scopedType,
      }
    }

    addDecision({
      lane: 'local',
      decision: 'blocked',
      reason: MODULE_RUNTIME_DECISION_REASONS.blockedByModuleFrontier,
      localEventType: scopedType,
    })

    return {
      status: 'blocked',
      event: parsedEvent,
      scopedType,
      reason: MODULE_RUNTIME_DECISION_REASONS.blockedByModuleFrontier,
    }
  }

  const emitOutboundEnvelope = (envelope: unknown): ModuleRuntimeOutboundEnvelopeResult => {
    let outboundEnvelope: ActorEnvelope
    try {
      outboundEnvelope = ActorEnvelopeSchema.parse(envelope)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = `module outbound envelope rejected: ${formatValidationError(error)}`
      addValidationDiagnostic({
        lane: 'outbound',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidOutboundEnvelope,
        error: message,
      })
      addDecision({
        lane: 'outbound',
        decision: 'rejected',
        reason: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidOutboundEnvelope,
      })

      return {
        status: 'rejected',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidOutboundEnvelope,
        error: message,
      }
    }

    const sourceMatchesModule =
      outboundEnvelope.source.kind === 'module' &&
      outboundEnvelope.source.moduleId === moduleId &&
      outboundEnvelope.source.id === moduleActorId

    if (!sourceMatchesModule) {
      const error =
        'module outbound envelope rejected: source must reference the owning module actor with matching id/kind/moduleId.'

      addValidationDiagnostic({
        lane: 'outbound',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.outboundSourceMismatch,
        error,
      })
      addDecision({
        lane: 'outbound',
        decision: 'rejected',
        reason: MODULE_RUNTIME_DIAGNOSTIC_CODES.outboundSourceMismatch,
        envelopeId: outboundEnvelope.id,
      })

      return {
        status: 'rejected',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.outboundSourceMismatch,
        error,
      }
    }

    const dispatchId = nextDispatchId('outbound')
    const snapshotStart = snapshots.length

    trigger({
      type: outboundIngressEventType,
      detail: ModuleRuntimeEnvelopeIngressDetailSchema.parse({
        dispatchId,
        moduleId,
        envelope: outboundEnvelope,
      }),
    })

    const ingressSelected = hasSelectedTriggerBid({
      snapshots,
      startIndex: snapshotStart,
      eventType: outboundIngressEventType,
      dispatchId,
    })
    const outboundSelected = hasSelectedTriggerBid({
      snapshots,
      startIndex: snapshotStart,
      eventType: outboundEventType,
      dispatchId,
    })

    if (ingressSelected && outboundSelected) {
      outboundEnvelopeHistory.push(structuredClone(outboundEnvelope))
      outboundEnvelopeQueue.push(structuredClone(outboundEnvelope))

      addDecision({
        lane: 'outbound',
        decision: 'approved',
        reason: MODULE_RUNTIME_DECISION_REASONS.passThrough,
        envelopeId: outboundEnvelope.id,
      })

      return {
        status: 'emitted',
        envelope: outboundEnvelope,
      }
    }

    addDecision({
      lane: 'outbound',
      decision: 'blocked',
      reason: MODULE_RUNTIME_DECISION_REASONS.blockedByModuleFrontier,
      envelopeId: outboundEnvelope.id,
    })

    return {
      status: 'blocked',
      envelope: outboundEnvelope,
      reason: MODULE_RUNTIME_DECISION_REASONS.blockedByModuleFrontier,
    }
  }

  const receiveInboundEnvelope = (envelope: unknown): ModuleRuntimeInboundEnvelopeResult => {
    let inboundEnvelope: ActorEnvelope
    try {
      inboundEnvelope = ActorEnvelopeSchema.parse(envelope)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = `module inbound envelope rejected: ${formatValidationError(error)}`
      addValidationDiagnostic({
        lane: 'inbound',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidInboundEnvelope,
        error: message,
      })
      addDecision({
        lane: 'inbound',
        decision: 'rejected',
        reason: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidInboundEnvelope,
      })

      return {
        status: 'rejected',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.invalidInboundEnvelope,
        error: message,
      }
    }

    const targetMatchesModule =
      inboundEnvelope.target?.kind === 'module' &&
      inboundEnvelope.target.moduleId === moduleId &&
      inboundEnvelope.target.id === moduleActorId

    if (!targetMatchesModule) {
      const error =
        'module inbound envelope rejected: target must reference the owning module actor with matching id/kind/moduleId.'

      addValidationDiagnostic({
        lane: 'inbound',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch,
        error,
      })
      addDecision({
        lane: 'inbound',
        decision: 'rejected',
        reason: MODULE_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch,
        envelopeId: inboundEnvelope.id,
      })

      return {
        status: 'rejected',
        code: MODULE_RUNTIME_DIAGNOSTIC_CODES.inboundTargetMismatch,
        error,
      }
    }

    const dispatchId = nextDispatchId('inbound')
    const snapshotStart = snapshots.length

    trigger({
      type: inboundIngressEventType,
      detail: ModuleRuntimeEnvelopeIngressDetailSchema.parse({
        dispatchId,
        moduleId,
        envelope: inboundEnvelope,
      }),
    })

    const ingressSelected = hasSelectedTriggerBid({
      snapshots,
      startIndex: snapshotStart,
      eventType: inboundIngressEventType,
      dispatchId,
    })
    const inboundSelected = hasSelectedTriggerBid({
      snapshots,
      startIndex: snapshotStart,
      eventType: inboundEventType,
      dispatchId,
    })

    if (ingressSelected && inboundSelected) {
      inboundEnvelopeHistory.push(structuredClone(inboundEnvelope))

      addDecision({
        lane: 'inbound',
        decision: 'approved',
        reason: MODULE_RUNTIME_DECISION_REASONS.passThrough,
        envelopeId: inboundEnvelope.id,
      })

      return {
        status: 'received',
        envelope: inboundEnvelope,
      }
    }

    addDecision({
      lane: 'inbound',
      decision: 'blocked',
      reason: MODULE_RUNTIME_DECISION_REASONS.blockedByModuleFrontier,
      envelopeId: inboundEnvelope.id,
    })

    return {
      status: 'blocked',
      envelope: inboundEnvelope,
      reason: MODULE_RUNTIME_DECISION_REASONS.blockedByModuleFrontier,
    }
  }

  const takeOutboundEnvelopes = () => {
    const queue = cloneEnvelopeHistory(outboundEnvelopeQueue)
    outboundEnvelopeQueue.length = 0
    return queue
  }

  const subscribeSnapshot: UseSnapshot = (listener: SnapshotListener) => useSnapshot(listener)

  return Object.freeze({
    authorityDomainId,
    moduleId,
    actorRef: {
      id: moduleActorId,
      kind: 'module' as const,
      moduleId,
    },
    addBThread,
    addBThreads,
    useFeedback,
    useSnapshot: subscribeSnapshot,
    triggerLocalEvent,
    emitOutboundEnvelope,
    receiveInboundEnvelope,
    takeOutboundEnvelopes,
    getLocalEventHistory: () => cloneLocalEventHistory(localEventHistory),
    getOutboundEnvelopeHistory: () => cloneEnvelopeHistory(outboundEnvelopeHistory),
    getInboundEnvelopeHistory: () => cloneEnvelopeHistory(inboundEnvelopeHistory),
    getValidationDiagnostics: () => cloneValidationDiagnostics(validationDiagnostics),
    getDecisionHistory: () => cloneDecisionHistory(decisions),
    getSnapshots: () => cloneSnapshots(snapshots),
  })
}

export type ModuleRuntimeActor = ReturnType<typeof createModuleRuntimeActor>

export type ModuleRuntimeEnvelopeEventDetail = ModuleRuntimeEnvelopeEventPayload

export type ActorDefinition = Readonly<{
  id: string
  kind: typeof ACTOR_DEFINITION_IDENTIFIER
  createRuntime: (options?: { authorityDomainId?: string }) => Promise<ModuleRuntimeActor>
}>

export const defineActor = ({ id, setup }: DefineActorOptions): ActorDefinition => {
  const moduleId = resolveModuleId(id)

  return Object.freeze({
    id: moduleId,
    kind: ACTOR_DEFINITION_IDENTIFIER,
    async createRuntime({ authorityDomainId }: { authorityDomainId?: string } = {}) {
      const runtime = createModuleRuntimeActor({
        authorityDomainId,
        moduleId,
      })
      await setup?.(runtime)
      return runtime
    },
  })
}

export const isActorDefinition = (value: unknown): value is ActorDefinition => {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const candidate = value as Partial<ActorDefinition>
  return (
    candidate.kind === ACTOR_DEFINITION_IDENTIFIER &&
    typeof candidate.id === 'string' &&
    typeof candidate.createRuntime === 'function'
  )
}
