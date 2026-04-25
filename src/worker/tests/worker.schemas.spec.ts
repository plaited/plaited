import { describe, expect, test } from 'bun:test'
import { WORKER_EVENTS } from '../worker.constants.ts'
import { WorkerCancelEventSchema, WorkerRunEventSchema, WorkerSetupEventSchema } from '../worker.schemas.ts'

describe('worker event schemas', () => {
  test('parses valid setup payloads', () => {
    const parsed = WorkerSetupEventSchema.parse({
      type: WORKER_EVENTS.setup,
      detail: { workerId: 'worker-1' },
    })

    expect(parsed).toEqual({
      type: WORKER_EVENTS.setup,
      detail: { workerId: 'worker-1' },
    })
  })

  test('parses valid run payloads', () => {
    const parsed = WorkerRunEventSchema.parse({
      type: WORKER_EVENTS.run,
      detail: { prompt: 'hello', cwd: '/tmp/plaited-worker' },
    })

    expect(parsed).toEqual({
      type: WORKER_EVENTS.run,
      detail: { prompt: 'hello', cwd: '/tmp/plaited-worker' },
    })
  })

  test('parses valid cancel payloads', () => {
    const parsed = WorkerCancelEventSchema.parse({
      type: WORKER_EVENTS.cancel,
      detail: { sessionId: 'session-1' },
    })

    expect(parsed).toEqual({
      type: WORKER_EVENTS.cancel,
      detail: { sessionId: 'session-1' },
    })
  })

  test('rejects invalid payloads', () => {
    expect(() =>
      WorkerSetupEventSchema.parse({
        type: WORKER_EVENTS.run,
        detail: { workerId: 'worker-1' },
      }),
    ).toThrow()

    expect(() =>
      WorkerRunEventSchema.parse({
        type: WORKER_EVENTS.run,
        detail: { cwd: '/tmp/plaited-worker' },
      }),
    ).toThrow()

    expect(() =>
      WorkerCancelEventSchema.parse({
        type: WORKER_EVENTS.cancel,
        detail: {},
      }),
    ).toThrow()
  })
})
