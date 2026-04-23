import * as z from 'zod'
import type { BPListener, JsonObject, SnapshotMessage } from '../behavioral.schemas.ts'
import { behavioral as createBehavioral } from '../behavioral.ts'
import type { BThreads, Disconnect, Sync } from '../behavioral.types.ts'
import { sync as baseSync, thread as baseThread } from '../behavioral.utils.ts'

export const onType = (type: string): BPListener => ({
  type,
})

export const onTypeWithDetail = ({
  type,
  detailSchema,
}: {
  type: string
  detailSchema: z.ZodObject<Record<string, z.ZodType<unknown>>>
}): BPListener => ({
  type,
  detailSchema,
})

export const onTypeWhere = ({
  type,
  predicate,
}: {
  type: string
  predicate: (detail: unknown) => boolean
}): BPListener => ({
  type,
  detailSchema: z.custom<unknown>(predicate) as unknown as z.ZodObject<Record<string, z.ZodType<unknown>>>,
})

type FeedbackDetail = JsonObject
type FeedbackHandler = {
  bivarianceHack(detail: FeedbackDetail, disconnect: Disconnect): void | Promise<void>
}['bivarianceHack']
type FeedbackHandlers = Record<string, FeedbackHandler>

export const sync: Sync = baseSync

/**
 * Test compatibility wrapper preserving legacy `thread(rules, repeat?)` semantics.
 * Legacy tests use omitted 2nd arg as "run once", and `true` as "repeat forever".
 */
export const thread = (rules: ReturnType<Sync>[], repeat?: true) =>
  repeat ? baseThread(rules) : baseThread(rules, true)

export const behavioral = () => {
  const runtime = createBehavioral()
  const snapshotListeners = new Set<(msg: SnapshotMessage) => void | Promise<void>>()

  const addBThread = (label: string, bThread: BThreads[string]) => {
    runtime.addThread(label, bThread)
  }

  const addBThreads = (threads: BThreads) => {
    for (const [label, bThread] of Object.entries(threads)) {
      addBThread(label, bThread)
    }
  }

  const useFeedback = (handlers: FeedbackHandlers): Disconnect => {
    const disconnects: Disconnect[] = []
    for (const [type, handler] of Object.entries(handlers)) {
      disconnects.push(runtime.addHandler(type, handler as (detail: unknown, disconnect: Disconnect) => void))
    }
    return () => {
      for (const disconnect of disconnects) {
        void disconnect()
      }
    }
  }

  const useSnapshot = (listener: (msg: SnapshotMessage) => void | Promise<void>): Disconnect => {
    snapshotListeners.add(listener)
    const disconnectRuntime = runtime.useSnapshot(listener)
    return () => {
      snapshotListeners.delete(listener)
      void disconnectRuntime()
    }
  }

  const reportSnapshot = (msg: SnapshotMessage) => {
    for (const listener of snapshotListeners) {
      void listener(msg)
    }
  }

  return {
    ...runtime,
    addBThread,
    addBThreads,
    useFeedback,
    useSnapshot,
    reportSnapshot,
  }
}
