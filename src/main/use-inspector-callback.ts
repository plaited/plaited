import type { InspectorCallback } from './b-element.types.ts'
import type { SnapshotMessage } from './behavioral.types.ts'
import type { CustomElementTag } from './create-template.types.ts'

export const useInspectorCallback = (tag: CustomElementTag, cb?: InspectorCallback) => (arg: SnapshotMessage) => {
  queueMicrotask(() => {
    console.group()
    console.info(tag)
    console.table(arg)
    console.groupEnd()
  })
  cb?.(arg)
}
