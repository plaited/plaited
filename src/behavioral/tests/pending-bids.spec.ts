import { describe, expect, test } from 'bun:test'
import type { PendingBidsTrace, Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

const jsonSchema = {
  type: 'object' as const,
  properties: { id: { type: 'string' as const } },
  required: ['id'],
  additionalProperties: false,
}

describe('pending_bids trace', () => {
  test('publishes pending_bids trace with thread states during superstep', () => {
    const seen: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    useTrace((msg) => {
      seen.push(msg)
    })

    addThread({ label: 'worker', rules: [{ request: { type: 'task' } }], once: true })
    trigger({ type: 'start' })

    const pending = seen.find((s) => s.kind === 'pending_bids')
    expect(pending).toBeDefined()
    expect(pending!.kind).toBe('pending_bids')
  })

  test('pending_bids appears before frontier in the same step', () => {
    const seen: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    useTrace((msg) => {
      seen.push(msg)
    })

    addThread({ label: 'req', rules: [{ request: { type: 'ping' } }], once: true })

    // Step 0: pending_bids + frontier (since there's no external trigger yet,
    // the first addThread only sets up running but doesn't trigger a step)
    // Step 1: after trigger, we get: pending_bids → frontier → selection
    trigger({ type: 'start' })

    const pendingIdx = seen.findIndex((s) => s.kind === 'pending_bids')
    const frontierIdx = seen.findIndex((s) => s.kind === 'frontier')

    // Both must be present and pending_bids must come before frontier
    expect(pendingIdx).not.toBe(-1)
    expect(frontierIdx).not.toBe(-1)
    expect(pendingIdx).toBeLessThan(frontierIdx)
  })

  test('detailSchema in pending_bids trace echoes the input JSON Schema without conversion', () => {
    const seen: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    useTrace((msg) => {
      seen.push(msg)
    })

    addThread({
      label: 'blocker',
      rules: [
        {
          block: [
            {
              type: 'task',
              detailSchema: jsonSchema,
            },
          ],
        },
      ],
    })
    addThread({ label: 'worker', rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })

    trigger({ type: 'start' })

    const pending = seen.find((s) => s.kind === 'pending_bids') as PendingBidsTrace | undefined
    expect(pending).toBeDefined()
    expect(pending!.threads.length).toBeGreaterThanOrEqual(2)

    // Find the blocker thread's block listener detailSchema
    const blocker = pending!.threads.find((t) => t.label === 'blocker')
    expect(blocker).toBeDefined()
    const block = blocker!.block
    expect(block).toBeDefined()
    const listener = block![0]!
    // The detailSchema in the trace must be deep-equal to the input, not a conversion
    expect(listener.detailSchema).toEqual(jsonSchema)
    // Specifically assert that additionalProperties: false survives (z.toJSONSchema drops it)
    expect(listener.detailSchema).toHaveProperty('additionalProperties', false)
  })
})
