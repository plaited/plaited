import { ensureArray } from '@plaited/utils'
import { Parameter, BPEvent, StateSnapshot } from './types.js'
import { isInParameter, isPendingRequest } from './utils.js'
export const stateSnapshot: StateSnapshot = ({ bids, selectedEvent }) => {
  const ruleSets: {
    thread: string
    request?: BPEvent[]
    waitFor?: Parameter[]
    block?: Parameter[]
    priority: number
  }[] = []
  for (const bid of bids) {
    const { generator: _, waitFor, block, request, thread, priority, trigger } = bid
    const obj = {
      thread,
      priority,
    }
    // !trigger && waitFor && Object.assign(obj, { waitFor: ensureArray(waitFor).some(isInParameter(selectedEvent)) })
    // block && Object.assign(obj, {block: ensureArray(block).some(isInParameter(selectedEvent))})
    request && Object.assign(obj, {request: ensureArray(request).some(isPendingRequest(selectedEvent))})

    ruleSets.push({
      ...obj,
      ...(thread === selectedEvent.thread  && { selected: selectedEvent.type }),
    })
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
