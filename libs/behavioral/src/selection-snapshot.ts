import { SelectionSnapshot } from './types.js'

import { isListeningFor, isPendingRequest } from './utils.js'
export const selectionSnapshot: SelectionSnapshot = ({ candidates, selectedEvent, pending }) => {
  const blockingThreads = [...pending].flatMap(({ block, thread }) =>
    block && Array.isArray(block) ? block.map((listener) => ({ block: listener, thread }))
    : block ? [{ block, thread }]
    : [],
  )
  const ruleSets: {
    thread: string
    selected: boolean
    type: string
    detail?: unknown
    priority: number
    blockedBy?: string
  }[] = []
  for (const bid of candidates) {
    const blockedCB = isListeningFor(bid)
    ruleSets.push({
      thread: bid.thread,
      selected: isPendingRequest(selectedEvent, bid),
      type: bid.type,
      priority: bid.priority,
      detail: bid.detail,
      blockedBy: blockingThreads.find(({ block }) => blockedCB(block))?.thread,
    })
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}
