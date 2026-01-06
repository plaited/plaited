import type { Disconnect, SnapshotMessage, UseSnapshot } from '../main/behavioral.types.ts'
import type { Inspector, InspectorCallback } from './b-element.types.ts'
import type { CustomElementTag } from './create-template.types.ts'

export const INSPECTOR_MESSAGE = 'INSPECTOR_MESSAGE'

let inspectorCallback: InspectorCallback | undefined

export const getInspector = ({
  useSnapshot,
  disconnectSet,
  element,
}: {
  useSnapshot: UseSnapshot
  disconnectSet: Set<Disconnect>
  element: CustomElementTag
}): Inspector => {
  const callback = (message: SnapshotMessage) => {
    queueMicrotask(() => {
      console.group()
      console.info(element)
      console.table(message)
      console.groupEnd()
    })
    inspectorCallback?.({
      type: INSPECTOR_MESSAGE,
      detail: {
        element,
        message,
      },
    })
  }
  let disconnect: Disconnect | undefined
  return {
    on: () => {
      disconnect = useSnapshot(callback)
      disconnectSet.add(disconnect)
    },
    off: () => {
      if (disconnect) {
        disconnect()
        disconnectSet.delete(disconnect)
        disconnect = undefined
      }
    },
  }
}

export const setInspectorCallback = (func?: InspectorCallback) => {
  inspectorCallback = func
}
