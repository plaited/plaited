import { describe, expect, test } from 'bun:test'
import { WorkerResearchOutputSchema } from '../worker.schemas.ts'

describe('WorkerResearchOutputSchema', () => {
  test('parses text chunk output payload', () => {
    const parsed = WorkerResearchOutputSchema.parse({
      kind: 'text_chunk',
      text: '{"summary":"partial"}',
    })

    expect(parsed.kind).toBe('text_chunk')
  })

  test('parses final and completed output payloads', () => {
    const finalText = WorkerResearchOutputSchema.parse({
      kind: 'final_text',
      text: '{"summary":"final"}',
    })
    const completed = WorkerResearchOutputSchema.parse({
      kind: 'completed',
      stopReason: 'end_turn',
    })

    expect(finalText.kind).toBe('final_text')
    expect(completed.kind).toBe('completed')
  })

  test('rejects unknown output payload kinds', () => {
    const result = WorkerResearchOutputSchema.safeParse({
      kind: 'backend_specific',
      raw: {},
    })

    expect(result.success).toBe(false)
  })
})
