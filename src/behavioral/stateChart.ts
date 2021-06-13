import {StateChart} from './types'
import {streamEvents} from './constants'
export const stateChart: StateChart = ({candidates, blocked, pending}) => {
  const strands = [...new Set(pending
    .filter(({strandName}) => strandName)
    .map(({strandName, priority}) => ({strandName, priority})))]
  const Blocked = [
    ...new Set(blocked.map(({eventName}) => eventName).filter(Boolean)),
  ]
  const Requests = [
    ...new Set(
      candidates
        .map(({
          eventName,
          priority,
          payload,
        }) => ({
          eventName,
          priority,
          payload,
        })),
    ),
  ]
  return {
    streamEvent: streamEvents.state,
    logicStrands: strands,
    requestedEvents: Requests,
    blockedEvents: Blocked,
  }
}
