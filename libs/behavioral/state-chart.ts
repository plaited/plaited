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
          event,
          priority,
          payload,
        }) => {
          const toRet: {
            event: string
            payload?: unknown
            priority: number
          } = { event, priority }
          payload && Object.assign(toRet, { payload })
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
