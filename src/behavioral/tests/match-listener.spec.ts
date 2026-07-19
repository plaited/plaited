import { expect, test } from 'bun:test'
import * as z from 'zod'
import { behavioral } from '../behavioral.ts'

test('match listener: waitFor resumes thread when type and detail schema match', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: waitFor does not resume when detail schema fails', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 101 } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: detailMatch invalid resumes thread when detail schema fails', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 101 } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
            detailMatch: 'invalid',
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: detailMatch invalid does not resume thread when detail schema passes', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
            detailMatch: 'invalid',
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: type mismatch prevents match when source and detail would pass', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'other', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('other', () => {
    log.push('other')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['other'])
})

test('match listener: sourceSchema request accepts only requested events', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: trigger and requested events both satisfy matching listeners', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'task', detail: { id: 'job-1' } })

  expect(log).toEqual(['task', 'ack', 'task'])
})

test('match listener: sourceSchema can accept trigger and request', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: sourceSchema request matches request-origin events only', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })
  trigger({
    type: 'task',
    detail: { id: 'job-1' },
  })

  expect(log).toEqual(['task', 'ack', 'task'])
})

test('match listener: block prevents matching requested event from being selected', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('blocker', {
    rules: [
      {
        block: [
          {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        ],
      },
    ],
    once: true,
  })
  addThread('taskProducer', { rules: [{ request: { type: 'task', detail: { id: 'job-1' } } }], once: true })
  addThread('safeProducer', { rules: [{ request: { type: 'safe' } }], once: true })
  addThread('safeFollower', {
    rules: [{ waitFor: [{ type: 'safe' }] }, { request: { type: 'safe_ack' } }],
    once: true,
  })
  addThread('taskFollower', {
    rules: [{ waitFor: [{ type: 'task' }] }, { request: { type: 'task_ack' } }],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('safe', () => {
    log.push('safe')
  })
  addHandler('safe_ack', () => {
    log.push('safe_ack')
  })
  addHandler('task_ack', () => {
    log.push('task_ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['safe', 'safe_ack'])
})

test('match listener: interrupt terminates thread when matching event is selected', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('interruptedThread', {
    rules: [
      {
        waitFor: [{ type: 'start' }],
        interrupt: [
          {
            type: 'kill',
            detailSchema: z.object({ id: z.literal('victim') }),
          },
        ],
      },
      { request: { type: 'after_start' } },
    ],
    once: true,
  })
  addThread('interruptProducer', {
    rules: [{ request: { type: 'kill', detail: { id: 'victim' } } }],
    once: true,
  })

  addHandler('kill', () => {
    log.push('kill')
  })
  addHandler('after_start', () => {
    log.push('after_start')
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'start' })

  expect(log).toEqual(['kill'])
})

test('match listener: detail-schema listeners can express conditional matching', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('producer', { rules: [{ request: { type: 'task', detail: { ok: true } } }], once: true })
  addThread('consumer', {
    rules: [
      {
        waitFor: [
          {
            type: 'task',
            detailSchema: z.object({ ok: z.literal(true) }),
          },
        ],
      },
      { request: { type: 'ack' } },
    ],
    once: true,
  })

  addHandler('task', () => {
    log.push('task')
  })
  addHandler('ack', () => {
    log.push('ack')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: non-selected same-type requesters remain pending until their own request is selected', () => {
  const log: string[] = []
  const { useAddThread, useTrigger, useAddHandler } = behavioral()
  const addThread = useAddThread()
  const trigger = useTrigger()
  const addHandler = useAddHandler()

  addThread('first', {
    rules: [{ request: { type: 'same', detail: { n: 1 } } }, { request: { type: 'first_done' } }],
    once: true,
  })
  addThread('second', {
    rules: [{ request: { type: 'same', detail: { n: 2 } } }, { request: { type: 'second_done' } }],
    once: true,
  })

  addHandler('same', ({ detail }: { detail: { n: number } }) => {
    log.push(`same:${detail.n}`)
  })
  addHandler('first_done', () => {
    log.push('first_done')
  })
  addHandler('second_done', () => {
    log.push('second_done')
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['same:1', 'first_done', 'same:2', 'second_done'])
})
