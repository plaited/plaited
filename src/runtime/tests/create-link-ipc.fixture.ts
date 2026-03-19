import { createLink } from '../runtime.ts'

type FixtureMessage = { type: 'task'; detail: { taskId: string; route: 'parent_to_child' } } | { type: 'ready' }

const link = createLink<FixtureMessage>({
  id: 'child-link',
  bridge: {
    send(message) {
      process.send?.(message)
    },
    receive(listener) {
      const onMessage = (message: unknown) => {
        if (!message || typeof message !== 'object') return
        if (!('type' in message)) return
        listener(message as FixtureMessage)
      }

      process.on('message', onMessage)
      return () => {
        process.off('message', onMessage)
      }
    },
  },
})

link.subscribe((message) => {
  if (message.type !== 'task') return

  process.send?.({
    type: 'received',
    detail: {
      taskId: message.detail.taskId,
      route: message.detail.route,
      linkId: link.id,
    },
  })
})

process.send?.({ type: 'ready' })
