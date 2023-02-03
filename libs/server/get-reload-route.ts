import { ReloadClient, Routes } from './types.ts'

const getMessage = (channel: string, data: string) => {
  const encoder = new TextEncoder()
  return encoder.encode(`event: ${channel}\nid: 0\ndata: ${data}\n\n\n`)
}

export const getReloadRoute = (
  reload: boolean,
  reloadClient: Array<ReloadClient>,
): Record<never, never> | Routes => {
  if (!reload) return {}
  return {
    ['/livereload']: () => {
      let timerId: number | undefined
      const init = {
        status: 200,
        headers: {
          connection: 'keep-alive',
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        },
      }
      const body = new ReadableStream({
        start(controller) {
          reloadClient.push(
            (channel: string, data: string) =>
              controller.enqueue(getMessage(channel, data)),
          )
          controller.enqueue(getMessage('connected', 'ready'))
          timerId = setInterval(() => {
            controller.enqueue(getMessage('ping', 'waiting'))
          }, 60000)
        },
        cancel() {
          if (typeof timerId === 'number') {
            clearInterval(timerId)
          }
        },
      })
      return new Response(body, init)
    },
  }
}
