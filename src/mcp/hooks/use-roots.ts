import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { ClientCapabilitiesSchema, RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Trigger, BThreads } from '../../main/behavioral.types.js'
import { bSync, bThread } from '../../main.js'
import { BP_EVENTS, BP_THREADS } from '../mcp.constants.js'

export const useRoots = ({
  trigger,
  server,
  bThreads,
  roots,
}: {
  trigger: Trigger
  server: McpServer['server']
  bThreads: BThreads
  roots?: z.infer<typeof ClientCapabilitiesSchema>['roots']
}) => {
  bThreads.set({
    [BP_THREADS.block_list_roots]: bThread(
      [bSync({ block: BP_EVENTS.roots_list, interrupt: BP_EVENTS.root_support_detected })],
      true,
    ),
    [BP_THREADS.on_root_detection]: bThread([
      bSync({ waitFor: BP_EVENTS.root_support_detected }),
      bSync({ request: { type: BP_EVENTS.roots_list } }),
    ]),
  })

  if (roots?.listChanged) {
    trigger({ type: BP_EVENTS.root_support_detected })
    server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
      trigger({ type: BP_EVENTS.roots_list })
    })
  }
}
