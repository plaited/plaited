import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { RootsListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import { useBehavioral, useSignal } from '../main.js'
import { keyMirror } from '../utils.js'

const BP_EVENTS = keyMirror(
  'root_support_detected',
  'roots_list',
  'scan_components',
  'start_test_server',
  'reload_test_server',
)
const BP_THREADS = keyMirror('on_root_detection', 'block_list_roots')

export const mcpBehavioral = useBehavioral<
  {
    [BP_EVENTS.roots_list]: void
    [BP_EVENTS.scan_components]: void
  },
  { mcp: McpServer }
>({
  async bProgram({ mcp, trigger, bThreads, bSync, bThread }) {
    const { server } = mcp
    const rootsSignal = useSignal()
    rootsSignal.listen(BP_EVENTS.scan_components, trigger)
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

    server.oninitialized = () => {
      const clientCapabilities = server.getClientCapabilities()
      if (clientCapabilities?.roots?.listChanged) {
        trigger({ type: BP_EVENTS.root_support_detected })
        server.setNotificationHandler(RootsListChangedNotificationSchema, () => {
          trigger({ type: BP_EVENTS.roots_list })
        })
      }
    }

    return {
      async [BP_EVENTS.roots_list]() {
        const roots = await server.listRoots()
        rootsSignal.set(roots)
      },
      async [BP_EVENTS.scan_components]() {},
      async [BP_EVENTS.start_test_server]() {},
      async [BP_EVENTS.reload_test_server]() {},
    }
  },
})
