import { StateChart } from './types.ts'
export const stateChart: StateChart = ({ candidates, blocked, pending }) => {
  const strands = [
    ...new Set(
      pending
        .filter(({ strandName }) => strandName)
        .map(({ strandName, priority }) => ({ strandName, priority })),
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
    logicStrands: strands,
    requestedEvents: Requests,
    blockedEvents: Blocked,
  }
}
