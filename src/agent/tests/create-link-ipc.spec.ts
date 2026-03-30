import { afterEach, describe, expect, test } from 'bun:test'

import { createIpcLinkBridge, createLink } from '../create-link.ts'

type ParentToChildMessage = { type: 'task'; detail: { taskId: string; route: 'parent_to_child' } }
type ChildSignalMessage =
  | { type: 'ready' }
  | { type: 'received'; detail: { taskId: string; route: 'parent_to_child'; linkId: string } }

const childProcesses: Array<ReturnType<typeof Bun.spawn>> = []
const flushAsyncWork = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(async () => {
  await Promise.all(
    childProcesses.splice(0).map(async (child) => {
      child.kill()
      await child.exited
    }),
  )
})

describe('createLink IPC bridge', () => {
  test('delivers canonical link messages across a Bun IPC boundary', async () => {
    const parentActivities: string[] = []
    const childMessages: Array<ParentToChildMessage | ChildSignalMessage> = []
    const childMessageListeners = new Set<(message: unknown) => void>()
    let readyResolve = () => {}
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve
    })
    let receivedResolve = (_message: ChildSignalMessage & { type: 'received' }) => {}
    const received = new Promise<ChildSignalMessage & { type: 'received' }>((resolve) => {
      receivedResolve = resolve
    })

    const child = Bun.spawn(['bun', 'src/agent/tests/create-link-ipc.fixture.ts'], {
      cwd: process.cwd(),
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'inherit',
      ipc(message) {
        for (const listener of childMessageListeners) {
          listener(message)
        }
      },
    })
    childProcesses.push(child)

    const link = createLink<ParentToChildMessage | ChildSignalMessage>({
      id: 'parent-link',
      onActivity(activity) {
        parentActivities.push(activity.kind)
      },
      bridge: createIpcLinkBridge({
        send(message) {
          child.send(message)
        },
        subscribe(listener) {
          childMessageListeners.add(listener)
          return () => {
            childMessageListeners.delete(listener)
          }
        },
      }),
    })

    link.subscribe((message) => {
      childMessages.push(message)

      if (message.type === 'ready') {
        readyResolve()
        return
      }

      if (message.type === 'received') {
        receivedResolve(message)
      }
    })

    await ready

    link.publish({
      type: 'task',
      detail: {
        taskId: 'task-1',
        route: 'parent_to_child',
      },
    })

    const childMessage = await received
    await flushAsyncWork()

    expect(childMessage).toEqual({
      type: 'received',
      detail: {
        taskId: 'task-1',
        route: 'parent_to_child',
        linkId: 'child-link',
      },
    })
    expect(childMessages).toEqual([
      { type: 'ready' },
      {
        type: 'task',
        detail: {
          taskId: 'task-1',
          route: 'parent_to_child',
        },
      },
      {
        type: 'received',
        detail: {
          taskId: 'task-1',
          route: 'parent_to_child',
          linkId: 'child-link',
        },
      },
    ])
    expect(parentActivities).toEqual(['subscribe', 'receive', 'publish', 'deliver', 'deliver', 'receive', 'deliver'])
  })

  test('emits bridge_failed when the bridge send operation throws', async () => {
    const activities: Array<{ kind: string; error?: string }> = []
    const link = createLink<ParentToChildMessage>({
      id: 'parent-link',
      onActivity(activity) {
        activities.push({ kind: activity.kind, error: activity.error })
      },
      bridge: createIpcLinkBridge({
        send() {
          throw new Error('send failed')
        },
        subscribe() {
          return () => {}
        },
      }),
    })

    link.publish({
      type: 'task',
      detail: {
        taskId: 'task-1',
        route: 'parent_to_child',
      },
    })
    await flushAsyncWork()

    expect(activities).toContainEqual({ kind: 'bridge_failed', error: 'send failed' })
  })
})
