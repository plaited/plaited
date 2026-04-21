import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from 'plaited/behavioral'

import { defineActor } from '../create-module-runtime-actor.ts'
import {
  createSupervisorRuntime,
  SUPERVISOR_DIAGNOSTIC_CODES,
  SUPERVISOR_RUNTIME_EVENTS,
} from '../create-supervisor-runtime.ts'

const createEnvelope = (id: string) => ({
  id,
  type: 'module:event',
  source: { id: 'module:planner', kind: 'module' as const, moduleId: 'planner' },
  target: { id: 'module:executor', kind: 'module' as const, moduleId: 'executor' },
  detail: {
    command: 'run',
    attempts: 1,
  },
  meta: {
    purpose: 'handoff',
    boundary: 'domain:node-local',
  },
})

describe('createSupervisorRuntime', () => {
  test('onboards defineActor outputs into the supervisor actor registry', async () => {
    const runtime = createSupervisorRuntime({ authorityDomainId: 'domain:node-local' })
    let setupActorId = ''

    const result = await runtime.onboardActor(
      defineActor({
        id: 'planner',
        setup(actor) {
          setupActorId = actor.actorRef.id
        },
      }),
    )

    expect(result.status).toBe('onboarded')
    if (result.status !== 'onboarded') {
      throw new Error('Expected actor onboarding to succeed.')
    }
    expect(result.actor.moduleId).toBe('planner')
    expect(setupActorId).toBe('module:planner')
    expect(runtime.getActorIds()).toEqual(['planner'])
    expect(runtime.getActor('planner')).toBe(result.actor)
  })

  test('rejects invalid and duplicate actor onboarding requests', async () => {
    const runtime = createSupervisorRuntime({ authorityDomainId: 'domain:node-local' })
    const definition = defineActor({ id: 'planner' })

    const invalid = await runtime.onboardActor({ id: 'planner' })
    expect(invalid.status).toBe('rejected')
    if (invalid.status !== 'rejected') {
      throw new Error('Expected invalid actor onboarding to be rejected.')
    }
    expect(invalid.code).toBe(SUPERVISOR_DIAGNOSTIC_CODES.invalidActorDefinition)

    const first = await runtime.onboardActor(definition)
    expect(first.status).toBe('onboarded')

    const duplicate = await runtime.onboardActor(definition)
    expect(duplicate.status).toBe('rejected')
    if (duplicate.status !== 'rejected') {
      throw new Error('Expected duplicate actor onboarding to be rejected.')
    }
    expect(duplicate.code).toBe(SUPERVISOR_DIAGNOSTIC_CODES.duplicateActor)
  })

  test('throws when authorityDomainId is an empty string', () => {
    expect(() => createSupervisorRuntime({ authorityDomainId: '' })).toThrowError(
      /authorityDomainId to be a non-empty string/,
    )
  })

  test('accepts valid envelopes and records replay/frontier diagnostics', () => {
    const runtime = createSupervisorRuntime({ authorityDomainId: 'domain:node-local' })
    const seenSnapshots: SnapshotMessage[] = []

    runtime.useSnapshot((snapshot) => {
      seenSnapshots.push(snapshot)
    })

    const resultA = runtime.receiveEnvelope(createEnvelope('env-1'))
    const resultB = runtime.receiveEnvelope(createEnvelope('env-2'))

    expect(resultA).toEqual({
      status: 'approved',
      envelope: createEnvelope('env-1'),
      frontierStatus: 'idle',
      replayHistorySize: 1,
    })
    expect(resultB).toEqual({
      status: 'approved',
      envelope: createEnvelope('env-2'),
      frontierStatus: 'idle',
      replayHistorySize: 2,
    })

    const replayHistory = runtime.getReplayHistory()
    expect(replayHistory).toHaveLength(2)
    expect(replayHistory.map((event) => event.type)).toEqual([
      SUPERVISOR_RUNTIME_EVENTS.envelopeReceived,
      SUPERVISOR_RUNTIME_EVENTS.envelopeReceived,
    ])
    expect(replayHistory.map((event) => event.source)).toEqual(['trigger', 'trigger'])

    const frontierDiagnostics = runtime.getFrontierDiagnostics()
    expect(frontierDiagnostics).toHaveLength(2)
    expect(frontierDiagnostics.at(-1)).toEqual(
      expect.objectContaining({
        kind: 'frontier',
        authorityDomainId: 'domain:node-local',
        envelopeId: 'env-2',
        frontierStatus: 'idle',
        candidateCount: 0,
        enabledCount: 0,
      }),
    )
    expect(frontierDiagnostics[1]!.replayHistory).toHaveLength(2)

    expect(runtime.getSelectedEnvelopeHistory().map((envelope) => envelope.id)).toEqual(['env-1', 'env-2'])
    expect(runtime.getDecisionHistory().map((decision) => decision.decision)).toEqual(['approved', 'approved'])
    expect(runtime.getDecisionHistory().map((decision) => decision.reason)).toEqual(['pass_through', 'pass_through'])

    const selectionSnapshots = seenSnapshots.filter((snapshot) => snapshot.kind === 'selection')
    expect(selectionSnapshots.length).toBeGreaterThan(0)
    const receivesEnvelopeEvent = selectionSnapshots.some((snapshot) =>
      snapshot.bids.some((bid) => bid.type === SUPERVISOR_RUNTIME_EVENTS.envelopeReceived && bid.source === 'trigger'),
    )
    expect(receivesEnvelopeEvent).toBe(true)
  })

  test('getter results are deeply cloned and cannot mutate internal history', () => {
    const runtime = createSupervisorRuntime({ authorityDomainId: 'domain:node-local' })
    runtime.receiveEnvelope(createEnvelope('env-1'))

    const selectedEnvelopeHistory = runtime.getSelectedEnvelopeHistory()
    const replayHistory = runtime.getReplayHistory()

    selectedEnvelopeHistory[0]!.detail!.command = 'mutated-selected-history'

    const replayDetail = replayHistory[0]!.detail as {
      authorityDomainId: string
      envelope: { detail?: { command?: string } }
    }
    replayDetail.envelope.detail!.command = 'mutated-replay-history'

    expect(runtime.getSelectedEnvelopeHistory()[0]!.detail!.command).toBe('run')

    const nextReplayDetail = runtime.getReplayHistory()[0]!.detail as {
      authorityDomainId: string
      envelope: { detail?: { command?: string } }
    }
    expect(nextReplayDetail.envelope.detail!.command).toBe('run')
  })

  test('rejects malformed envelopes and emits validation diagnostics', () => {
    const runtime = createSupervisorRuntime({ authorityDomainId: 'domain:node-local' })
    const seenSnapshots: SnapshotMessage[] = []

    runtime.useSnapshot((snapshot) => {
      seenSnapshots.push(snapshot)
    })

    const result = runtime.receiveEnvelope({
      type: 'module:event',
      source: { id: 'module:planner', kind: 'module' },
    })

    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.code).toBe(SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope)
      expect(result.error).toContain('supervisor envelope rejected')
    }

    expect(runtime.getReplayHistory()).toEqual([])
    expect(runtime.getFrontierDiagnostics()).toEqual([])
    expect(runtime.getSelectedEnvelopeHistory()).toEqual([])

    const validationDiagnostics = runtime.getValidationDiagnostics()
    expect(validationDiagnostics).toHaveLength(1)
    expect(validationDiagnostics[0]).toEqual(
      expect.objectContaining({
        kind: 'validation',
        authorityDomainId: 'domain:node-local',
        code: SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope,
      }),
    )

    const decisionHistory = runtime.getDecisionHistory()
    expect(decisionHistory).toHaveLength(1)
    expect(decisionHistory[0]).toEqual(
      expect.objectContaining({
        decision: 'rejected',
        reason: SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope,
        envelopeId: null,
      }),
    )

    expect(seenSnapshots).toContainEqual(
      expect.objectContaining({
        kind: 'extension_error',
        id: 'domain:node-local:supervisor:invalid_envelope',
      }),
    )
  })

  test('rejects non-JSON envelope detail values without throwing', () => {
    const runtime = createSupervisorRuntime({ authorityDomainId: 'domain:node-local' })

    const result = runtime.receiveEnvelope({
      ...createEnvelope('env-bad-json'),
      detail: {
        fn: () => 1,
      },
    })

    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') {
      throw new Error('Expected rejected supervisor receive result.')
    }
    expect(result.code).toBe(SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope)
    expect(result.error).toContain('supervisor envelope rejected')
    expect(runtime.getReplayHistory()).toEqual([])
    expect(runtime.getFrontierDiagnostics()).toEqual([])
    expect(runtime.getValidationDiagnostics()).toContainEqual(
      expect.objectContaining({
        kind: 'validation',
        code: SUPERVISOR_DIAGNOSTIC_CODES.invalidEnvelope,
      }),
    )
  })
})
