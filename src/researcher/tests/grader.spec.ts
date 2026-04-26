import { describe, expect, test } from 'bun:test'
import { gradeResearchResult } from '../grader.ts'

describe('gradeResearchResult', () => {
  test('returns passing score for strong structured output', () => {
    const result = gradeResearchResult({
      task: 'Implement worker-backed researcher loop',
      contextPacket: {
        summary: 'Context assembled',
        filesToRead: ['src/researcher/research.ts'],
        symbolsOrTargets: ['runResearch'],
        citedDocsSkills: [],
        claims: ['Worker runtime integration is required'],
        rationale: 'explicit worker setup/run orchestration',
        openQuestions: ['Should retries be bounded?'],
        suggestedChecks: ['bun --bun tsc --noEmit'],
        provenance: [{ source: 'code' }],
        review: 'Check for risk around worker lifecycle and verify cleanup.',
      },
      consumerResult: {
        finalText:
          'Implemented explicit behavioral event flow with context and consumer worker runs, fixed grader, and observation writes.',
        filesWritten: ['src/researcher/research.ts'],
        executionOutput: 'No execution required.',
        testOutput: 'bun test src/researcher/tests passed.',
      },
      modelAReview: 'Review indicates risk around worker lifecycle and recommends verification checks.',
      contextWorkerSnapshots: [
        {
          kind: 'worker',
          workerId: 'context-worker',
          sessionId: 'context-session',
          payload: { sourceEvent: 'tool_call', payload: { toolName: 'read' } },
        },
      ],
      reviewWorkerSnapshots: [
        {
          kind: 'worker',
          workerId: 'review-worker',
          sessionId: 'review-session',
          payload: { sourceEvent: 'agent_message_chunk', payload: { text: '{"review":"ok"}' } },
        },
      ],
      consumerWorkerSnapshots: [
        {
          kind: 'worker',
          workerId: 'consumer-worker',
          sessionId: 'consumer-session',
          payload: { sourceEvent: 'tool_call', payload: { command: 'bun test src/researcher/tests' } },
        },
        {
          kind: 'worker',
          workerId: 'consumer-worker',
          sessionId: 'consumer-session',
          payload: { sourceEvent: 'tool_call_update', payload: { stdout: 'pass' } },
        },
      ],
      fileWriteEvidence: {
        claimedFilesCount: 1,
        checkedFilesCount: 1,
        claimedFilesWithinCwdCount: 1,
        claimedFilesChangedDuringRunCount: 1,
        files: [
          {
            path: 'src/researcher/research.ts',
            absolutePath: '/tmp/src/researcher/research.ts',
            withinCwd: true,
            before: { exists: true, sizeBytes: 10, modifiedMs: 1 },
            after: { exists: true, sizeBytes: 20, modifiedMs: 2 },
            createdDuringRun: false,
            modifiedDuringRun: true,
            changedDuringRun: true,
          },
        ],
      },
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0.67)
  })

  test('fails when final text is missing despite other signals', () => {
    const result = gradeResearchResult({
      task: 'Implement worker-backed researcher loop',
      contextPacket: {
        summary: 'Context assembled',
        filesToRead: ['src/researcher/research.ts'],
        symbolsOrTargets: ['runResearch'],
        citedDocsSkills: [],
        claims: ['Worker runtime integration is required'],
        rationale: 'explicit worker setup/run orchestration',
        openQuestions: ['Should retries be bounded?'],
        suggestedChecks: ['bun --bun tsc --noEmit'],
        provenance: [{ source: 'code' }],
      },
      consumerResult: {
        finalText: '',
        filesWritten: ['src/researcher/research.ts'],
        executionOutput: 'No execution required.',
        testOutput: 'tests unavailable',
      },
      modelAReview: undefined,
      contextWorkerSnapshots: [],
      reviewWorkerSnapshots: [],
      consumerWorkerSnapshots: [],
      fileWriteEvidence: {
        claimedFilesCount: 1,
        checkedFilesCount: 1,
        claimedFilesWithinCwdCount: 1,
        claimedFilesChangedDuringRunCount: 0,
        files: [
          {
            path: 'src/researcher/research.ts',
            absolutePath: '/tmp/src/researcher/research.ts',
            withinCwd: true,
            before: { exists: true, sizeBytes: 10, modifiedMs: 1 },
            after: { exists: true, sizeBytes: 10, modifiedMs: 1 },
            createdDuringRun: false,
            modifiedDuringRun: false,
            changedDuringRun: false,
          },
        ],
      },
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBeLessThanOrEqual(0.65)
  })

  test('ignores explicit researcher output payloads as trajectory evidence', () => {
    const result = gradeResearchResult({
      task: 'Validate trajectory evidence only comes from raw backend traces',
      contextPacket: {
        summary: 'Context assembled',
        filesToRead: ['src/researcher/research.ts'],
        symbolsOrTargets: ['runResearch'],
        citedDocsSkills: [],
        claims: ['Worker runtime integration is required'],
        rationale: 'explicit worker setup/run orchestration',
        openQuestions: [],
        suggestedChecks: ['bun --bun tsc --noEmit'],
        provenance: [{ source: 'code' }],
      },
      consumerResult: {
        finalText: 'Completed output text for grader contamination regression coverage.',
        filesWritten: [],
        executionOutput: 'Claimed execution text from final answer only.',
        testOutput: 'Claimed test text from final answer only.',
      },
      modelAReview: 'Review indicates risks to verify.',
      contextWorkerSnapshots: [],
      reviewWorkerSnapshots: [],
      consumerWorkerSnapshots: [
        {
          kind: 'worker',
          workerId: 'consumer-worker',
          sessionId: 'consumer-session',
          payload: {
            researcherOutput: {
              kind: 'final_text',
              text: 'Ran bun test src/researcher/tests and all pass with stdout and stderr.',
            },
          },
        },
        {
          kind: 'worker',
          workerId: 'consumer-worker',
          sessionId: 'consumer-session',
          payload: {
            stopReason: 'completed',
            researcherOutput: {
              kind: 'completed',
              stopReason: 'completed',
            },
          },
        },
      ],
      fileWriteEvidence: {
        claimedFilesCount: 0,
        checkedFilesCount: 0,
        claimedFilesWithinCwdCount: 0,
        claimedFilesChangedDuringRunCount: 0,
        files: [],
      },
    })

    expect(result.outcome?.executionTraceSignal).toBe(false)
    expect(result.outcome?.testTraceSignal).toBe(false)
    expect(result.reasoning).toContain('executionTraceSignal=false')
    expect(result.reasoning).toContain('testTraceSignal=false')
  })
})
