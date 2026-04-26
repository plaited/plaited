import { describe, expect, test } from 'bun:test'
import { ResearchGraderInputSchema } from '../grader.schemas.ts'

describe('ResearchGraderInputSchema', () => {
  test('parses grading input with explicit worker trace evidence', () => {
    const parsed = ResearchGraderInputSchema.parse({
      task: 'Validate researcher grading split',
      contextPacket: {
        summary: 'Context summary',
        filesToRead: ['src/researcher/research.ts'],
        symbolsOrTargets: ['runResearch'],
        citedDocsSkills: [],
        claims: ['claim'],
        rationale: 'rationale',
        openQuestions: [],
        suggestedChecks: ['bun test src/researcher/tests'],
        provenance: [{ source: 'fixture' }],
      },
      consumerResult: {
        finalText: 'Completed output text',
        filesWritten: ['src/researcher/research.ts'],
      },
      modelAReview: 'Review text',
      contextWorkerSnapshots: [
        {
          kind: 'worker',
          workerId: 'context',
          sessionId: 'context-session',
          payload: { sourceEvent: 'tool_call' },
        },
      ],
      reviewWorkerSnapshots: [],
      consumerWorkerSnapshots: [
        {
          kind: 'worker',
          workerId: 'consumer',
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

    expect(parsed.consumerWorkerSnapshots.length).toBe(1)
    expect(parsed.fileWriteEvidence.claimedFilesChangedDuringRunCount).toBe(1)
  })
})
