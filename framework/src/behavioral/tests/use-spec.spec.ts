import { describe, expect, test } from 'bun:test'
import { useSpec } from '../use-spec.ts'

describe('useSpec', () => {
  test('returns label and converts spec sync points into behavioral idioms', () => {
    const [label, specThread] = useSpec({
      label: 'job-worker',
      thread: {
        once: true,
        syncPoints: [
          {
            request: {
              type: 'start',
              detail: { jobId: 'a1' },
            },
          },
          {
            waitFor: [
              {
                type: 'task',
                detailSchema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                  },
                  required: ['id'],
                  additionalProperties: false,
                },
              },
            ],
            block: [{ type: 'cancel' }],
          },
        ],
      },
    })

    expect(label).toBe('job-worker')

    const iterator = specThread()
    const first = iterator.next()
    expect(first.done).toBe(false)
    expect(first.value).toEqual({
      request: {
        type: 'start',
        detail: { jobId: 'a1' },
      },
    })

    const second = iterator.next()
    expect(second.done).toBe(false)
    const waitForListeners = second.value?.waitFor
    const waitForListener = Array.isArray(waitForListeners) ? waitForListeners[0] : waitForListeners
    expect(waitForListener?.type).toBe('task')
    expect(waitForListener?.detailSchema?.safeParse({ id: 'ok' }).success).toBe(true)
    expect(waitForListener?.detailSchema?.safeParse({ id: 1 }).success).toBe(false)
    expect(second.value?.block).toEqual([{ type: 'cancel' }])

    const third = iterator.next()
    expect(third.done).toBe(true)
  })

  test('repeats when spec thread.once is omitted', () => {
    const [, specThread] = useSpec({
      label: 'looping-worker',
      thread: {
        syncPoints: [{ request: { type: 'tick', detail: { sequence: 1 } } }],
      },
    })

    const iterator = specThread()
    const first = iterator.next()
    const second = iterator.next()
    const third = iterator.next()

    expect(first.done).toBe(false)
    expect(second.done).toBe(false)
    expect(third.done).toBe(false)
    expect(first.value?.request).toEqual({ type: 'tick', detail: { sequence: 1 } })
    expect(second.value?.request).toEqual({ type: 'tick', detail: { sequence: 1 } })
    expect(third.value?.request).toEqual({ type: 'tick', detail: { sequence: 1 } })
  })
})
