import { expect, test } from 'bun:test'
import * as z from 'zod'
import { behavioral, onType, onTypeWithDetail, sync, thread } from './helpers.ts'

test('match listener: waitFor resumes thread when type and detail schema match', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: waitFor does not resume when detail schema fails', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 101 } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: detailMatch invalid resumes thread when detail schema fails', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 101 } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
          detailMatch: 'invalid',
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: detailMatch invalid does not resume thread when detail schema passes', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
          detailMatch: 'invalid',
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task'])
})

test('match listener: type mismatch prevents match when source and detail would pass', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'other', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          source: 'request',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    other() {
      log.push('other')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['other'])
})

test('match listener: sourceSchema request accepts only requested events', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          source: 'request',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: sourceSchema trigger accepts only externally triggered events', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          source: 'trigger',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'task', detail: { id: 'job-1' } })

  expect(log).toEqual(['task', 'task', 'ack'])
})

test('match listener: sourceSchema can accept trigger and request', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: sourceSchema request matches request-origin events only', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    consumer: thread([
      sync({
        waitFor: {
          type: 'task',
          source: 'request',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
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
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    blocker: thread([
      sync({
        block: {
          type: 'task',
          source: 'request',
          detailSchema: z.object({ id: z.string() }),
        },
      }),
    ]),
    taskProducer: thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })]),
    safeProducer: thread([sync({ request: { type: 'safe' } })]),
    safeFollower: thread([sync({ waitFor: onType('safe') }), sync({ request: { type: 'safe_ack' } })]),
    taskFollower: thread([sync({ waitFor: onType('task') }), sync({ request: { type: 'task_ack' } })]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    safe() {
      log.push('safe')
    },
    safe_ack() {
      log.push('safe_ack')
    },
    task_ack() {
      log.push('task_ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['safe', 'safe_ack'])
})

test('match listener: interrupt terminates thread when matching event is selected', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    interruptedThread: thread([
      sync({
        waitFor: onType('start'),
        interrupt: {
          type: 'kill',
          source: 'request',
          detailSchema: z.object({ id: z.literal('victim') }),
        },
      }),
      sync({ request: { type: 'after_start' } }),
    ]),
    interruptProducer: thread([sync({ request: { type: 'kill', detail: { id: 'victim' } } })]),
  })

  useFeedback({
    kill() {
      log.push('kill')
    },
    after_start() {
      log.push('after_start')
    },
  })

  trigger({ type: 'kickoff' })
  trigger({ type: 'start' })

  expect(log).toEqual(['kill'])
})

test('match listener: detail-schema listeners can express conditional matching', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    producer: thread([sync({ request: { type: 'task', detail: { ok: true } } })]),
    consumer: thread([
      sync({
        waitFor: onTypeWithDetail({
          type: 'task',
          detailSchema: z.object({ ok: z.literal(true) }),
        }),
      }),
      sync({ request: { type: 'ack' } }),
    ]),
  })

  useFeedback({
    task() {
      log.push('task')
    },
    ack() {
      log.push('ack')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['task', 'ack'])
})

test('match listener: non-selected same-type requesters remain pending until their own request is selected', () => {
  const log: string[] = []
  const { addBThreads, trigger, useFeedback } = behavioral()

  addBThreads({
    first: thread([sync({ request: { type: 'same', detail: { n: 1 } } }), sync({ request: { type: 'first_done' } })]),
    second: thread([sync({ request: { type: 'same', detail: { n: 2 } } }), sync({ request: { type: 'second_done' } })]),
  })

  useFeedback({
    same(detail: { n: number }) {
      log.push(`same:${detail.n}`)
    },
    first_done() {
      log.push('first_done')
    },
    second_done() {
      log.push('second_done')
    },
  })

  trigger({ type: 'kickoff' })

  expect(log).toEqual(['same:1', 'first_done', 'same:2', 'second_done'])
})
