import * as z from 'zod'

import { EVENT_SOURCES, type FRONTIER_STATUS } from './behavioral.constants.ts'
import { replayToFrontier } from './behavioral.frontier.ts'
import { type ActorEnvelope, ActorEnvelopeSchema, type SnapshotMessage } from './behavioral.schemas.ts'
import { bSync, bThread } from './behavioral.shared.ts'
import { behavioral } from './behavioral.ts'
import type { ReplayEvent, SnapshotListener, UseSnapshot } from './behavioral.types.ts'
import { isActorDefinition, type ModuleRuntimeActor } from './create-module-runtime-actor.ts'

const DEFAULT_AUTHORITY_DOMAIN_ID = 'node-local'
const AuthorityDomainIdSchema = z.string().min(1)

export const SUPERVISOR_RUNTIME_EVENTS = {
  envelopeReceived: 'supervisor:envelope_received',
} as const

export const SUPERVISOR_DIAGNOSTIC_CODES = {
  actorSetupFailed: 'actor_setup_failed',
  duplicateActor: 'duplicate_actor',
  invalidActorDefinition: 'invalid_actor_definition',
  invalidEnvelope: 'invalid_envelope',
} as const

const SupervisorEnvelopeEventDetailSchema = z.object({
  authorityDomainId: z.string().min(1),
  envelope: ActorEnvelopeSchema,
})

type SupervisorEnvelopeEventDetail = z.infer<typeof SupervisorEnvelopeEventDetailSchema>

type SupervisorEventDetails = {
  [SUPERVISOR_RUNTIME_EVENTS.envelopeReceived]: SupervisorEnvelopeEventDetail
}

const createSupervisorThreads = () => ({
  supervisorIngress: bThread(
    [
      bSync({
        waitFor: {
          type: SUPERVISOR_RUNTIME_EVENTS.envelopeReceived,
          sourceSchema: z.literal('trigger'),
          detailSchema: SupervisorEnvelopeEventDetailSchema,
        },
      }),
    ],
    true,
  ),
})

const cloneReplayHistory = (history: ReplayEvent[]) => structuredClone(history)

const cloneEnvelopeHistory = (history: ActorEnvelope[]) => structuredClone(history)

const cloneFrontierDiagnostics = (diagnostics: SupervisorFrontierDiagnostic[]) => structuredClone(diagnostics)

const cloneValidationDiagnostics = (diagnostics: SupervisorValidationDiagnostic[]) => structuredClone(diagnostics)

const cloneDecisionHistory = (decisions: SupervisorDecisionRecord[]) => structuredClone(decisions)

const cloneSnapshots = (snapshots: SnapshotMessage[]) => structuredClone(snapshots)

const formatValidationError = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.map((segment) => String(segment)).join('.') || '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')

export type CreateSupervisorRuntimeOptions = {
  authorityDomainId?: string
}

export type SupervisorFrontierDiagnostic = {
  kind: 'frontier'
  timestamp: number
  authorityDomainId: string
  envelopeId: string
  frontierStatus: keyof typeof FRONTIER_STATUS
  candidateCount: number
  enabledCount: number
  replayHistory: ReplayEvent[]
}

export type SupervisorValidationDiagnostic = {
  kind: 'validation'
  timestamp: number
  authorityDomainId: string
  code: (typeof SUPERVISOR_DIAGNOSTIC_CODES)[keyof typeof SUPERVISOR_DIAGNOSTIC_CODES]
  error: string
}

export type SupervisorDiagnostic = SupervisorFrontierDiagnostic | SupervisorValidationDiagnostic

export type SupervisorDecisionRecord = {
  decision: 'approved' | 'rejected'
  reason: 'pass_through' | (typeof SUPERVISOR_DIAGNOSTIC_CODES)[keyof typeof SUPERVISOR_DIAGNOSTIC_CODES]
  timestamp: number
  authorityDomainId: string
  envelopeId: string | null
  actorId?: string
  frontierStatus?: keyof typeof FRONTIER_STATUS
}

export type SupervisorReceiveResult =
  | {
      status: 'approved'
      envelope: ActorEnvelope
      frontierStatus: keyof typeof FRONTIER_STATUS
      replayHistorySize: number
    }
  | {
      status: 'rejected'
      code: (typeof SUPERVISOR_DIAGNOSTIC_CODES)['invalidEnvelope']
      error: string
    }

export type SupervisorOnboardActorResult =
  | {
      status: 'onboarded'
      actor: ModuleRuntimeActor
    }
  | {
      status: 'rejected'
      code:
        | (typeof SUPERVISOR_DIAGNOSTIC_CODES)['invalidActorDefinition']
        | (typeof SUPERVISOR_DIAGNOSTIC_CODES)['duplicateActor']
        | (typeof SUPERVISOR_DIAGNOSTIC_CODES)['actorSetupFailed']
      error: string
    }

const resolveAuthorityDomainId = (authorityDomainId?: string) => {
  if (authorityDomainId === undefined) {
    return DEFAULT_AUTHORITY_DOMAIN_ID
  }

  try {
    return AuthorityDomainIdSchema.parse(authorityDomainId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('createSupervisorRuntime requires authorityDomainId to be a non-empty string when provided.')
    }

    throw error
  }
}

export const createSupervisorRuntime = (options: CreateSupervisorRuntimeOptions = {}) => {
  const authorityDomainId = resolveAuthorityDomainId(options.authorityDomainId)
  const replayThreads = createSupervisorThreads()
  const replayHistory: ReplayEvent[] = []
  const selectedEnvelopeHistory: ActorEnvelope[] = []
  const frontierDiagnostics: SupervisorFrontierDiagnostic[] = []
  const validationDiagnostics: SupervisorValidationDiagnostic[] = []
  const decisions: SupervisorDecisionRecord[] = []
  const snapshots: SnapshotMessage[] = []
  const actors = new Map<string, ModuleRuntimeActor>()

  const { addBThreads, reportSnapshot, trigger, useFeedback, useSnapshot } = behavioral<SupervisorEventDetails>()

  addBThreads(replayThreads)

  useSnapshot((snapshot) => {
    snapshots.push(snapshot)
  })

  useFeedback({
    [SUPERVISOR_RUNTIME_EVENTS.envelopeReceived](detail) {
      const event: ReplayEvent = {
        type: SUPERVISOR_RUNTIME_EVENTS.envelopeReceived,
        source: EVENT_SOURCES.trigger,
        detail,
      }

      replayHistory.push(event)
      selectedEnvelopeHistory.push(detail.envelope)

      const replay = replayToFrontier({
        threads: replayThreads,
        history: replayHistory,
      })

      const diagnostic: SupervisorFrontierDiagnostic = {
        kind: 'frontier',
        timestamp: Date.now(),
        authorityDomainId,
        envelopeId: detail.envelope.id,
        frontierStatus: replay.frontier.status,
        candidateCount: replay.frontier.candidates.length,
        enabledCount: replay.frontier.enabled.length,
        replayHistory: cloneReplayHistory(replayHistory),
      }
      frontierDiagnostics.push(diagnostic)

      decisions.push({
        decision: 'approved',
        reason: 'pass_through',
        timestamp: diagnostic.timestamp,
        authorityDomainId,
        envelopeId: detail.envelope.id,
        frontierStatus: diagnostic.frontierStatus,
      })
    },
  })

  const rejectActorOnboarding = ({
    actorId,
    code,
    error,
  }: {
    actorId?: string
    code:
      | (typeof SUPERVISOR_DIAGNOSTIC_CODES)['invalidActorDefinition']
      | (typeof SUPERVISOR_DIAGNOSTIC_CODES)['duplicateActor']
      | (typeof SUPERVISOR_DIAGNOSTIC_CODES)['actorSetupFailed']
    error: string
  }): Extract<SupervisorOnboardActorResult, { status: 'rejected' }> => {
    const timestamp = Date.now()
    reportSnapshot({
      kind: 'extension_error',
      id: actorId ? `${authorityDomainId}:supervisor:${actorId}:${code}` : `${authorityDomainId}:supervisor:${code}`,
      error,
    })
    validationDiagnostics.push({
      kind: 'validation',
      timestamp,
      authorityDomainId,
      code,
      error,
    })
    decisions.push({
      decision: 'rejected',
      reason: code,
      timestamp,
      authorityDomainId,
      envelopeId: null,
      ...(actorId !== undefined && { actorId }),
    })
    return {
      status: 'rejected',
      code,
      error,
    }
  }

  const onboardActor = async (definition: unknown): Promise<SupervisorOnboardActorResult> => {
    if (!isActorDefinition(definition)) {
      return rejectActorOnboarding({
        code: SUPERVISOR_DIAGNOSTIC_CODES.invalidActorDefinition,
        error: 'supervisor actor onboarding rejected: expected a defineActor(...) default export.',
      })
    }

    if (actors.has(definition.id)) {
      return rejectActorOnboarding({
        actorId: definition.id,
        code: SUPERVISOR_DIAGNOSTIC_CODES.duplicateActor,
        error: `supervisor actor onboarding rejected: duplicate actor id "${definition.id}".`,
      })
    }

    try {
      const actor = await definition.createRuntime({ authorityDomainId })
      actors.set(definition.id, actor)
      return {
        status: 'onboarded',
        actor,
      }
    } catch (error) {
      return rejectActorOnboarding({
        actorId: definition.id,
        code: SUPERVISOR_DIAGNOSTIC_CODES.actorSetupFailed,
        error: `supervisor actor onboarding rejected: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  const receiveEnvelope = (envelope: unknown): SupervisorReceiveResult => {
    let parsedEnvelope: ActorEnvelope
    try {
      parsedEnvelope = ActorEnvelopeSchema.parse(envelope)
    } catch (error) {
      if (!(error instanceof z.ZodError)) {
        throw error
      }

      const message = `supervisor envelope rejected: ${formatValidationError(error)}`
      const timestamp = Date.now()

      reportSnapshot({
        kind: 'extension_error',
        id: `${authorityDomainId}:supervisor:invalid_envelope`,
        error: message,
      })

      validationDiagnostics.push({
        kind: 'validation',
        timestamp,
        authorityDomainId,
        code: SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope,
        error: message,
      })

      decisions.push({
        decision: 'rejected',
        reason: SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope,
        timestamp,
        authorityDomainId,
        envelopeId: null,
      })

      return {
        status: 'rejected',
        code: SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope,
        error: message,
      }
    }

    trigger({
      type: SUPERVISOR_RUNTIME_EVENTS.envelopeReceived,
      detail: {
        authorityDomainId,
        envelope: parsedEnvelope,
      },
    })

    const lastDiagnostic = frontierDiagnostics.at(-1)
    if (!lastDiagnostic) {
      throw new Error('Supervisor runtime expected a frontier diagnostic after receiving a valid envelope.')
    }

    return {
      status: 'approved',
      envelope: parsedEnvelope,
      frontierStatus: lastDiagnostic.frontierStatus,
      replayHistorySize: replayHistory.length,
    }
  }

  const subscribeSnapshot: UseSnapshot = (listener: SnapshotListener) => useSnapshot(listener)

  return Object.freeze({
    authorityDomainId,
    onboardActor,
    receiveEnvelope,
    useSnapshot: subscribeSnapshot,
    getActor: (actorId: string) => actors.get(actorId),
    getActorIds: () => [...actors.keys()].sort(),
    getReplayHistory: () => cloneReplayHistory(replayHistory),
    getSelectedEnvelopeHistory: () => cloneEnvelopeHistory(selectedEnvelopeHistory),
    getFrontierDiagnostics: () => cloneFrontierDiagnostics(frontierDiagnostics),
    getValidationDiagnostics: () => cloneValidationDiagnostics(validationDiagnostics),
    getDiagnostics: (): SupervisorDiagnostic[] =>
      structuredClone<SupervisorDiagnostic[]>([...frontierDiagnostics, ...validationDiagnostics]),
    getDecisionHistory: () => cloneDecisionHistory(decisions),
    getSnapshots: () => cloneSnapshots(snapshots),
  })
}

export type SupervisorRuntime = ReturnType<typeof createSupervisorRuntime>
