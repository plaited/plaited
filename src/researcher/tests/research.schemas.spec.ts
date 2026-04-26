import { describe, expect, test } from 'bun:test'
import {
  ContextPacketSchema,
  ResearchCliInputSchema,
  ResearchGradeSchema,
  ResearchObservationSchema,
} from '../research.schemas.ts'

describe('researcher schemas', () => {
  test('parses context packet with required structured fields', () => {
    const parsed = ContextPacketSchema.parse({
      summary: 'Context summary',
      filesToRead: ['src/researcher/research.ts'],
      symbolsOrTargets: ['runResearch'],
      citedDocsSkills: [
        {
          kind: 'skill',
          reference: 'skills/plaited-runtime/SKILL.md',
        },
      ],
      claims: ['Worker runtime is the execution surface.'],
      rationale: 'Aligns with runtime wiring constraints.',
      openQuestions: ['Should retries be bounded?'],
      suggestedChecks: ['bun --bun tsc --noEmit'],
      provenance: [{ source: 'code', evidence: 'src/worker/pi.worker.ts', confidence: 0.9 }],
      review: 'Keep orchestration explicit.',
    })

    expect(parsed.filesToRead).toEqual(['src/researcher/research.ts'])
    expect(parsed.provenance[0]?.source).toBe('code')
  })

  test('applies researcher CLI defaults', () => {
    const parsed = ResearchCliInputSchema.parse({
      task: 'Investigate worker-backed researcher loop',
    })

    expect(parsed.contextWorkerId).toBe('researcher-context-worker')
    expect(parsed.consumerWorkerId).toBe('researcher-consumer-worker')
    expect(parsed.reviewWorkerId).toBe('researcher-review-worker')
    expect(parsed.observationPath).toBe('.plaited/researcher/observations.jsonl')
    expect(parsed.timeoutMs).toBeGreaterThan(0)
  })

  test('validates observation artifact shape', () => {
    const grade = ResearchGradeSchema.parse({
      pass: true,
      score: 0.8,
      reasoning: 'Deterministic fixture score.',
    })

    const observation = ResearchObservationSchema.parse({
      observationId: 'obs-1',
      timestamp: new Date().toISOString(),
      durationMs: 15,
      task: 'research task',
      status: 'done',
      contextPacket: {
        summary: 'Context summary',
        filesToRead: ['src/researcher/research.ts'],
        symbolsOrTargets: ['runResearch'],
        citedDocsSkills: [],
        claims: ['claim'],
        rationale: 'rationale',
        openQuestions: [],
        suggestedChecks: [],
        provenance: [{ source: 'fixture' }],
      },
      consumerResult: {
        finalText: 'final text',
        filesWritten: [],
      },
      grade,
      traces: {
        behavioralSnapshots: [],
        contextWorkerSnapshots: [],
        reviewWorkerSnapshots: [],
        consumerWorkerSnapshots: [],
      },
      meta: {
        contextWorkerId: 'context-worker',
        consumerWorkerId: 'consumer-worker',
        reviewWorkerId: 'review-worker',
        contextWorkerEntrypoint: '/tmp/fake-context-worker.ts',
        consumerWorkerEntrypoint: '/tmp/fake-consumer-worker.ts',
        reviewWorkerEntrypoint: '/tmp/fake-review-worker.ts',
        observationPath: '/tmp/obs.jsonl',
      },
    })

    expect(observation.status).toBe('done')
    expect(observation.grade?.score).toBe(0.8)
  })
})
