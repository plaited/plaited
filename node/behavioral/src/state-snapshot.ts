import { ParameterIdiom, RequestIdiom, StateSnapshot } from './types.js'

export const stateSnapshot: StateSnapshot = ({ bids, selectedEvent }) => {
  const ruleSets: {
    thread: string
    request?: RequestIdiom[]
    waitFor?: ParameterIdiom[]
    block?: ParameterIdiom[]
    priority: number
  }[] = []
  for (const bid of bids) {
    const { generator: _, waitFor, block, request, thread, priority, trigger } =
      bid
    const obj = {
      thread,
      priority,
    }
    let selected
    waitFor &&
      Object.assign(obj, {
        waitFor: Array.isArray(waitFor) ? waitFor : [ waitFor ],
      })
    block &&
      Object.assign(obj, {
        block: Array.isArray(block) ? block : [ block ],
      })
    if (request) {
      const arr = Array.isArray(request) ? request : [ request ]
      arr.some(({ type }) =>
        type === selectedEvent.type && priority === selectedEvent.priority
      ) &&
        (selected = selectedEvent.type)
      Object.assign(obj, {
        request: arr,
      })
    }

    ruleSets.push({
      ...obj,
      ...(trigger && { trigger }),
      ...(selected && { selected }),
    })
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
