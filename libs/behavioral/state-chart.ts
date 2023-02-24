import { StateChart } from './types.ts'
export const stateChart: StateChart = ({ candidates, blocked, pending }) => {
  const threads = [
    ...new Set(
      pending
        .filter(({ name }) => name)
        .map(({ name, priority }) => ({ name, priority })),
    ),
  ]
  const Blocked = [
    ...new Set(blocked.map(({ type }) => type).filter(Boolean)),
  ]
  const Requests = [
    ...new Set(
      candidates
        .map(({
          type,
          priority,
          data,
        }) => {
          const toRet: {
            type: string
            data?: unknown
            priority: number
          } = { type, priority }
          data && Object.assign(toRet, { data })
          return toRet
        }),
    ),
  ]
  return {
    bThread: threads,
    requestedEvents: Requests,
    blockedEvents: Blocked,
  }
}
