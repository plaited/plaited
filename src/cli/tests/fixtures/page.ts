import { definePage } from '../../../b-program/define-page.ts'
import { sync, thread } from '../../../behavioral.ts'

/**
 * A page program fixture for frontier-analysis CLI tests.
 *
 * Threads are registered statically so `extractThreads` can capture them
 * without a running engine.
 */
export const page = definePage(({ addThread: at, sync: sy, thread: th }) => {
  at('ticker', th([sy({ request: { type: 'tick' } })], true))
  at('worker', th([sy({ request: { type: 'start', detail: { id: 'job-1' } } })], true))
  return
})

// Also keep a bare thread export so the same fixture exercises both branches.
export const standalone = thread([sync({ request: { type: 'ping' } })], true)
