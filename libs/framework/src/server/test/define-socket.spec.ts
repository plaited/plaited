import { test, expect } from 'bun:test'
import { defineSocket } from '../define-socket.js'
import { SocketMessage } from '../../client/types.js'
import { wait } from '@plaited/utils'

const connect = async () =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket('ws://localhost:3000')
    socket.onopen = function () {
      resolve(socket)
    }
    socket.onerror = function (err) {
      reject(err)
    }
  })

test('defineSocket', async () => {
  const [address, handler] = defineSocket(
    ({ send }) => {
      const client = send('client')
      return {
        foo() {
          client({ type: 'bar', detail: 'baz' })
        },
      }
    },
    { publicEvents: ['foo'], address: 'socket' },
  )
  const server = Bun.serve({
    port: 3000,
    fetch(req, server) {
      if (server.upgrade(req)) {
        console.log('upgrade')
        return
      }
      return new Response('Upgrade failed', { status: 500 })
    },
    websocket: {
      open(ws) {
        handler.open(ws)
      },
      message(ws, message) {
        const evt = JSON.parse(message as string) as SocketMessage
        if (evt.address === address) {
          handler.message(ws, evt.event)
        }
      },
    },
  })
  const socket = await connect()
  let actual: SocketMessage | undefined
  socket.addEventListener('message', (event) => {
    actual = JSON.parse(event.data)
  })
  const message: SocketMessage = { address: 'socket', event: { type: 'foo' } }
  socket.send(JSON.stringify(message))
  await wait(100)
  expect(actual).toEqual({ address: 'client', event: { type: 'bar', detail: 'baz' } })
  server.stop()
})
