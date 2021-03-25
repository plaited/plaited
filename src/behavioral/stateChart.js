import {streamEvents} from './constants.js'
export const stateChart = ({candidates, blocked, pending}) => {
  const strands = [...pending]
    .filter(({strandName}) => strandName)
    .map(({strandName}) => strandName)
  const Blocked = [
    ...new Set(blocked.map(({eventName}) => eventName).filter(Boolean)),
  ]
  const Requests = [
    ...new Set(candidates
      .map(request => ({
        eventName: request.eventName,
        payload: request.payload,
      }))
      .filter(Boolean)),
  ]
  return {
    streamEvent: streamEvents.state,
    logicStrands: [...new Set(strands)],
    requestedEvents: Requests,
    blockedEvents: Blocked,
  }
}
