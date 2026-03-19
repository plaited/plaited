import { afterEach, describe, expect, test } from 'bun:test'

import { createLink } from '../runtime.ts'

type ParentToChildMessage = { type: 'task'; detail: { taskId: string; route: 'parent_to_child' } }
type ChildSignalMessage =
  | { type: 'ready' }
  | { type: 'received'; detail: { taskId: string; route: 'parent_to_child'; linkId: string } }

const childProcesses: Array<ReturnType<typeof Bun.spawn>> = []

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
    const events: string[] = []
    let childReadyResolve = () => {}
    const childReady = new Promise<void>((resolve) => {
      childReadyResolve = resolve
    })
    let receivedResolve = (_message: ChildSignalMessage & { type: 'received' }) => {}
    const received = new Promise<ChildSignalMessage & { type: 'received' }>((resolve) => {
      receivedResolve = resolve
    })

    const child = Bun.spawn(['bun', 'src/runtime/tests/create-link-ipc.fixture.ts'], {
      cwd: process.cwd(),
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'inherit',
      ipc(message) {
        if (!message || typeof message !== 'object') return
        if (!('type' in message)) return

        const typedMessage = message as ChildSignalMessage
        if (typedMessage.type === 'ready') {
          childReadyResolve()
          return
        }

        if (typedMessage.type === 'received') {
          receivedResolve(typedMessage)
        }
      },
    })
    childProcesses.push(child)

    const link = createLink<ParentToChildMessage>({
      id: 'parent-link',
      onActivity(activity) {
        events.push(activity.kind)
      },
      bridge: {
        send(message) {
          child.send(message)
        },
        receive() {
          return () => {}
        },
      },
    })

    await childReady

    link.publish({
      type: 'task',
      detail: {
        taskId: 'task-1',
        route: 'parent_to_child',
      },
    })

    const childMessage = await received

    expect(childMessage).toEqual({
      type: 'received',
      detail: {
        taskId: 'task-1',
        route: 'parent_to_child',
        linkId: 'child-link',
      },
    })
    expect(events).toEqual(['publish'])
  })
})
