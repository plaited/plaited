import { isTypeOf } from "@plaited/utils"
import { BPListener, SelectionSnapshot, BPEvent, CandidateBid, BPEventTemplate } from "./types.js"
export const triggerWaitFor = () => true
export const isPendingRequest = (selectedEvent: CandidateBid, event:BPEvent | BPEventTemplate) => isTypeOf<BPEventTemplate>(event, 'function') 
  ? event === selectedEvent?.template
  : event.type== selectedEvent.type

export const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean => typeof listener !== 'string'
    ? listener({
        detail,
        type,
      })
    : listener === type
}

/** default dev callback function */
export const log = (log: ReturnType<SelectionSnapshot>) => console.table(log)