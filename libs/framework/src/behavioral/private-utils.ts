import { isTypeOf } from '@plaited/utils'
import { BPListener, BPEvent, CandidateBid, BPEventTemplate } from './types.js'

export const triggerWaitFor = () => true

export const isPendingRequest = (selectedEvent: CandidateBid, event: BPEvent | BPEventTemplate) =>
  isTypeOf<BPEventTemplate>(event, 'function') ? event === selectedEvent?.template : event.type == selectedEvent.type

export const isListeningFor = ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    typeof listener !== 'string' ?
      listener({
        detail,
        type,
      })
    : listener === type
}

export const createPublisher = <T>() => {
  const listeners = new Set<(value: T) => void | Promise<void>>()
  function publisher(value: T) {
    for (const cb of listeners) {
      void cb(value)
    }
  }
  publisher.subscribe = (listener: (msg: T) => void | Promise<void>) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return publisher
}

export const ensureArray = <T>(obj: T | T[] = []) => (Array.isArray(obj) ? obj : [obj])
