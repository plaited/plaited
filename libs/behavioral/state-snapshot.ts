import { ParameterIdiom, RequestIdiom, StateSnapshot } from './types.ts'
export const stateSnapshot: StateSnapshot = ({ bids, selectedEvent }) => {
  const bThreads: {
    name: string
    request?: RequestIdiom[]
    waitFor?: ParameterIdiom[]
    block?: ParameterIdiom[]
    priority: number
  }[] = []
  for (const bid of bids) {
    const { bThread: _, waitFor, block, request, ...rest } = bid
    const obj = rest
    request &&
      Object.assign(obj, {
        request: [...(Array.isArray(request) ? request : [request])],
      })
    waitFor &&
      Object.assign(obj, {
        waitFor: [...(Array.isArray(waitFor) ? waitFor : [waitFor])],
      })
    block &&
      Object.assign(obj, {
        block: [...(Array.isArray(block) ? block : [block])],
      })
    bThreads.push(rest)
  }
  return Object.freeze({
    selectedEvent,
    bThreads,
  })
}
