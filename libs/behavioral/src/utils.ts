import { isTypeOf } from "@plaited/utils"
import { Parameter, StateSnapshot, BPEvent, CandidateBid, BPEventTemplate } from "./types.js"
export const triggerWaitFor = () => true
export const isPendingRequest = (bid: CandidateBid) => (event:BPEvent | BPEventTemplate) => isTypeOf<BPEventTemplate>(event, 'function') 
  ? event === bid?.template
  : event.type== bid.type

export const isInParameter = ({ type, detail }: CandidateBid) => {
  return (param: Parameter): boolean => typeof param !== 'string'
    ? param({
        detail,
        type,
      })
    : param === type
}

/** default dev callback function */
export const log = (log: ReturnType<StateSnapshot>) => console.table(log)