import { ParameterIdiom, RequestIdiom, StateSnapshot } from './types.ts'
export const stateSnapshot: StateSnapshot = ({ bids, selectedEvent }) => {
  const ruleSets: {
    thread: string
    request?: RequestIdiom[]
    waitFor?: ParameterIdiom[]
    block?: ParameterIdiom[]
    priority: number
  }[] = []
  for (const bid of bids) {
    const { generator: _, waitFor, block, request, ...rest } = bid
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
    ruleSets.push(rest)
  }
  return Object.freeze({
    selectedEvent,
    ruleSets,
  })
}
