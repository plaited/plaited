import { createIpcLinkBridge, createLink } from '../runtime.ts'

type FixtureMessage =
  | { type: 'task'; detail: { taskId: string; route: 'parent_to_child' } }
  | { type: 'ready' }
  | { type: 'received'; detail: { taskId: string; route: 'parent_to_child'; linkId: string } }

const link = createLink<FixtureMessage>({
  id: 'child-link',
  bridge: createIpcLinkBridge({
    send(message) {
      process.send?.(message)
    },
    subscribe(listener) {
      const onMessage = (message: unknown) => {
        listener(message)
      }

      process.on('message', onMessage)
      return () => {
        process.off('message', onMessage)
      }
    },
  }),
})

link.subscribe((message) => {
  if (message.type !== 'task') return

  link.publish({
    type: 'received',
    detail: {
      taskId: message.detail.taskId,
      route: message.detail.route,
      linkId: link.id,
    },
  })
})

link.publish({ type: 'ready' })
