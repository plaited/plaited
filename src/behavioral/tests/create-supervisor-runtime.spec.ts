import { describe, expect, test } from 'bun:test'
import type { SnapshotMessage } from 'plaited/behavioral'

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
})
