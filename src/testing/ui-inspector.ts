import { type CustomElementTag, type Inspector, type SnapshotMessage, useInspectorCallback } from '../main.ts'
import type { UI_SNAPSHOT_EVENTS } from './testing.constants.ts'
import type { Send } from './testing.types.ts'

export const uiInspector = ({
  tag,
  type,
  inspector,
  send,
}: {
  tag: CustomElementTag
  type: keyof typeof UI_SNAPSHOT_EVENTS
  send: Send
  inspector: Inspector
}) => {
  if (!window?.__PLAITED_RUNNER__) {
    const cb = useInspectorCallback(tag, (detail: SnapshotMessage) => {
      send({
        type,
        detail,
      })
    })
    window?.__PLAITED_MCP__ && inspector.assign(cb)
    inspector.on()
  }
}
