import { DefaultLogger } from './types.js'

import { isListeningFor, isPendingRequest } from './private-utils.js'

export const defaultLogger: DefaultLogger = ({ candidates, selectedEvent, pending }) => {
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
    trigger?: true | 'object' | 'person'
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
      trigger: bid.trigger,
    })
  }
  return ruleSets.sort((a, b) => a.priority - b.priority)
}

defaultLogger.callback = (log) => console.table(log)
