import { Parameter, Log, BPEvent, CandidateBid } from "./types.js"
export const triggerWaitFor = () => true
export const isPendingRequest = (bid: CandidateBid) => (event:BPEvent) => bid.type === event.type

export const isInParameter = ({ type, detail }: CandidateBid) => {
  return (param: Parameter): boolean => typeof param !== 'string'
    ? param({
        detail,
        type,
      })
    : param === type
}

/** default dev callback function */
export const log = (log: Log) => console.table(log)