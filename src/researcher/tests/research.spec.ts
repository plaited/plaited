import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ResearchObservationSchema } from '../research.schemas.ts'
import { runResearch } from '../research.ts'

const FIXTURE_WORKER = fileURLToPath(new URL('./fixtures/fake-worker.ts', import.meta.url))
const FIXTURE_REVIEW_WORKER = fileURLToPath(new URL('./fixtures/fake-review-worker.ts', import.meta.url))
const RESEARCH_SOURCE_PATH = fileURLToPath(new URL('../research.ts', import.meta.url))

const createTempRunDir = async (): Promise<string> => mkdtemp(join(tmpdir(), 'plaited-researcher-'))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasResearcherOutputKind = ({
  snapshots,
  kind,
}: {
  snapshots: { payload: Record<string, unknown> }[]
  kind: 'text_chunk' | 'final_text' | 'completed'
}): boolean => {
  return snapshots.some((snapshot) => {
    const researcherOutput = snapshot.payload.researcherOutput
    if (!isRecord(researcherOutput)) return false
    return researcherOutput.kind === kind
  })
}

const seedRunWorkspace = async ({ cwd }: { cwd: string }): Promise<void> => {
  await Bun.write(join(cwd, 'unchanged-existing.txt'), 'seeded-before-run\n')
}

const readSingleObservation = async ({ observationPath }: { observationPath: string }) => {
  const observationText = await Bun.file(observationPath).text()
  const [line] = observationText.trim().split('\n')
  expect(typeof line).toBe('string')
  return ResearchObservationSchema.parse(JSON.parse(line ?? ''))
}

describe('runResearch', () => {
  test('keeps backend-native trajectory decoding out of research orchestration', async () => {
    const source = await Bun.file(RESEARCH_SOURCE_PATH).text()
    expect(source.includes('assistantMessageEvent')).toBe(false)
    expect(source.includes('text_delta')).toBe(false)
    expect(source.includes('agent_message_chunk')).toBe(false)
    expect(source.includes('payload.stopReason')).toBe(false)
  })

  test('reconstructs structured output from streamed chunks and writes consistent traces', async () => {
    const cwd = await createTempRunDir()
    await seedRunWorkspace({ cwd })
    const observationPath = join(cwd, 'observations.jsonl')

    const result = await runResearch({
      task: 'Build first-pass researcher loop',
      cwd,
      contextWorkerEntrypoint: FIXTURE_WORKER,
      consumerWorkerEntrypoint: FIXTURE_WORKER,
      reviewWorkerEntrypoint: FIXTURE_WORKER,
      observationPath,
      timeoutMs: 2_000,
    })

    expect(result.status).toBe('done')
    expect(result.contextPacket?.filesToRead).toContain('src/researcher/research.ts')
    expect(result.modelAReview).toContain('moderate risk')
    expect(result.consumerResult?.filesWritten).toContain('written-by-consumer.txt')
    expect(result.fileWriteEvidence?.claimedFilesChangedDuringRunCount).toBe(1)
    expect(result.grade?.pass).toBe(true)

    const observation = await readSingleObservation({ observationPath })
    expect(observation.status).toBe('done')
    expect(observation.contextPacket?.summary).toContain('Focused context')
    expect(observation.modelAReview).toContain('moderate risk')
    expect(observation.consumerResult?.finalText).toContain('first-pass behavioral researcher loop')
    expect(observation.contextRawOutput).toContain('Focused context for deterministic researcher test flow.')
    expect(observation.contextRawOutput?.includes('noise-before')).toBe(false)
    expect(observation.fileWriteEvidence?.claimedFilesChangedDuringRunCount).toBe(1)
    expect(
      observation.fileWriteEvidence?.files.find((row) => row.path === 'written-by-consumer.txt')?.changedDuringRun,
    ).toBe(true)
    expect(
      observation.fileWriteEvidence?.files.find((row) => row.path === 'unchanged-existing.txt')?.changedDuringRun,
    ).toBe(false)
    expect(observation.traces.modelASessionIds?.context).toBe('fixture-context-session')
    expect(observation.traces.modelASessionIds?.review).toBe('fixture-review-session')
    expect(observation.traces.consumerSessionId).toBe('fixture-consumer-session')
    expect(
      observation.traces.contextWorkerSnapshots.some(
        (snapshot) => snapshot.payload.sourceEvent === 'agent_message_chunk',
      ),
    ).toBe(true)
    expect(
      observation.traces.contextWorkerSnapshots.some((snapshot) => snapshot.payload.sourceEvent === 'tool_call'),
    ).toBe(true)
    expect(
      hasResearcherOutputKind({
        snapshots: observation.traces.contextWorkerSnapshots,
        kind: 'text_chunk',
      }),
    ).toBe(true)
    expect(
      hasResearcherOutputKind({
        snapshots: observation.traces.contextWorkerSnapshots,
        kind: 'final_text',
      }),
    ).toBe(true)
    expect(
      hasResearcherOutputKind({
        snapshots: observation.traces.contextWorkerSnapshots,
        kind: 'completed',
      }),
    ).toBe(true)
  })

  test('uses explicit review worker entrypoint when provided', async () => {
    const cwd = await createTempRunDir()
    await seedRunWorkspace({ cwd })
    const observationPath = join(cwd, 'observations.jsonl')

    const result = await runResearch({
      task: 'Build first-pass researcher loop',
      cwd,
      contextWorkerEntrypoint: FIXTURE_WORKER,
      consumerWorkerEntrypoint: FIXTURE_WORKER,
      reviewWorkerEntrypoint: FIXTURE_REVIEW_WORKER,
      observationPath,
      timeoutMs: 2_000,
    })

    expect(result.status).toBe('done')
    expect(result.modelAReview).toContain('Alternate review worker selected explicitly')

    const observation = await readSingleObservation({ observationPath })
    expect(observation.meta.reviewWorkerEntrypoint).toBe(FIXTURE_REVIEW_WORKER)
    expect(observation.traces.modelASessionIds?.review).toBe('fixture-alt-review-session')
    expect(
      observation.traces.reviewWorkerSnapshots.some((snapshot) => snapshot.payload.type === 'message_update'),
    ).toBe(true)
    expect(
      hasResearcherOutputKind({
        snapshots: observation.traces.reviewWorkerSnapshots,
        kind: 'final_text',
      }),
    ).toBe(true)
  })

  test('emits research_error and still writes observation on consumer worker failure', async () => {
    const cwd = await createTempRunDir()
    await seedRunWorkspace({ cwd })
    const observationPath = join(cwd, 'observations.jsonl')

    const result = await runResearch({
      task: 'Build first-pass researcher loop FAIL_CONSUMER',
      cwd,
      contextWorkerEntrypoint: FIXTURE_WORKER,
      consumerWorkerEntrypoint: FIXTURE_WORKER,
      reviewWorkerEntrypoint: FIXTURE_WORKER,
      observationPath,
      timeoutMs: 2_000,
    })

    expect(result.status).toBe('error')
    expect(result.error?.stage).toBe('consumer_worker_run')

    const observation = await readSingleObservation({ observationPath })
    expect(observation.status).toBe('error')
    expect(observation.error?.stage).toBe('consumer_worker_run')
  })

  test('appends observations across multiple runs to the same JSONL file', async () => {
    const cwd = await createTempRunDir()
    await seedRunWorkspace({ cwd })
    const observationPath = join(cwd, 'observations.jsonl')

    const first = await runResearch({
      task: 'First run',
      cwd,
      contextWorkerEntrypoint: FIXTURE_WORKER,
      consumerWorkerEntrypoint: FIXTURE_WORKER,
      reviewWorkerEntrypoint: FIXTURE_WORKER,
      observationPath,
      timeoutMs: 2_000,
    })
    const second = await runResearch({
      task: 'Second run',
      cwd,
      contextWorkerEntrypoint: FIXTURE_WORKER,
      consumerWorkerEntrypoint: FIXTURE_WORKER,
      reviewWorkerEntrypoint: FIXTURE_WORKER,
      observationPath,
      timeoutMs: 2_000,
    })

    expect(first.status).toBe('done')
    expect(second.status).toBe('done')

    const lines = (await Bun.file(observationPath).text())
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
    expect(lines.length).toBe(2)
  })
})
