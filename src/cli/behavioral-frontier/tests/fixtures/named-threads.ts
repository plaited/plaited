import { sync, thread } from '../../../../behavioral.ts'

export const createThreads = () => ({
  ping: thread([sync({ request: { type: 'ping' } })], true),
})
