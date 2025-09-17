import { bSync, bThread } from '../main.js'
import { keyMirror } from '../utils.js'

export const BP_EVENTS = keyMirror('root_support_detected', 'roots_list', 'scan_components')
export const BP_THREADS = keyMirror('on_root_detection', 'block_list_roots')

export const threads = {
  [BP_THREADS.block_list_roots]: bThread(
    [bSync({ block: BP_EVENTS.roots_list, interrupt: BP_EVENTS.root_support_detected })],
    true,
  ),
  [BP_THREADS.on_root_detection]: bThread([
    bSync({ waitFor: BP_EVENTS.root_support_detected }),
    bSync({ request: { type: BP_EVENTS.roots_list } }),
  ]),
}
