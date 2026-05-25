import { expect, test } from 'bun:test'
import * as z from 'zod'
import { behavioral } from '../behavioral.ts'
import { sync, thread } from '../behavioral.utils.ts'

test('match listener: waitFor resumes thread when type and detail schema match', () => {
  const log: string[] = []
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 101 } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 101 } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
            detailMatch: 'invalid',
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
            detailMatch: 'invalid',
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'other', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread(
    'blocker',
    thread(
      [
        sync({
          block: {
            type: 'task',
            detailSchema: z.object({ id: z.string() }),
          },
        }),
      ],
      true,
    ),
  )
  addThread('taskProducer', thread([sync({ request: { type: 'task', detail: { id: 'job-1' } } })], true))
  addThread('safeProducer', thread([sync({ request: { type: 'safe' } })], true))
  addThread(
    'safeFollower',
    thread([sync({ waitFor: { type: 'safe' } }), sync({ request: { type: 'safe_ack' } })], true),
  )
  addThread(
    'taskFollower',
    thread([sync({ waitFor: { type: 'task' } }), sync({ request: { type: 'task_ack' } })], true),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread(
    'interruptedThread',
    thread(
      [
        sync({
          waitFor: { type: 'start' },
          interrupt: {
            type: 'kill',
            detailSchema: z.object({ id: z.literal('victim') }),
          },
        }),
        sync({ request: { type: 'after_start' } }),
      ],
      true,
    ),
  )
  addThread('interruptProducer', thread([sync({ request: { type: 'kill', detail: { id: 'victim' } } })], true))

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread('producer', thread([sync({ request: { type: 'task', detail: { ok: true } } })], true))
  addThread(
    'consumer',
    thread(
      [
        sync({
          waitFor: {
            type: 'task',
            detailSchema: z.object({ ok: z.literal(true) }),
          },
        }),
        sync({ request: { type: 'ack' } }),
      ],
      true,
    ),
  )

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
  const { addThread, trigger, addHandler } = behavioral()

  addThread(
    'first',
    thread([sync({ request: { type: 'same', detail: { n: 1 } } }), sync({ request: { type: 'first_done' } })], true),
  )
  addThread(
    'second',
    thread([sync({ request: { type: 'same', detail: { n: 2 } } }), sync({ request: { type: 'second_done' } })], true),
  )

  addHandler('same', (detail: { n: number }) => {
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
