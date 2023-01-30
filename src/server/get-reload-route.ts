import { Routes, HandlerContext } from './types.ts'

export const getMessage = (channel:string, data:string) => {
  const encoder = new TextEncoder()
  return encoder.encode(`event: ${channel}\nid: 0\ndata: ${data}\n`)
}



// export const getReloadRoute = (reload: boolean, reloadClients: WritableStreamDefaultWriter[]): Record<never, never> | Routes => {
//   if(!reload) return {}
//   return {
//     ['/livereload']: (req: Response, ctx: HandlerContext) => {
//       let timerId: number | undefined;
//       const init = ({
//         status: 200,
//         headers: {
//         connection: 'keep-alive',
//         'content-type': 'text/event-stream',
//         'cache-control': 'no-cache',
//       }})
//       const stream = new TransformStream({
//         transform(chunk, controller) {
//           const { channel, data } = chunk;
//           controller.enqueue(getMessage(channel, data));
//         },
//         start(controller) {
//           controller.enqueue(getMessage('connected', 'ready'))
//           timerId = setInterval(() => {
//             controller.enqueue(getMessage('ping', 'waiting'))
//           }, 60000)
//         }
//       })
//       const reader = stream.readable.getReader()
//       reader.cancel = async () => {
//         if (typeof timerId === "number") {
//             clearInterval(timerId);
//         }
//       }
//       const writer  = stream.writable.getWriter();
//       reloadClients.push(writer)
//       return new Response(stream.readable, init)
//     },
//   }
// }


export const getReloadRoute = (reload: boolean, reader: ReadableStreamDefaultReader): Record<never, never> | Routes => {
  if(!reload) return {}
  return {
    ['/livereload']: (req: Response, ctx: HandlerContext) => {
      let timerId: number | undefined;
      const init = ({
        status: 200,
        headers: {
        // connection: 'keep-alive',
        'content-type': 'text/event-stream',
        // 'cache-control': 'no-cache',
      }})
      const body = new ReadableStream({
        async start(controller) {
          controller.enqueue(getMessage('connected', 'ready'))
          timerId = setInterval(() => {
            controller.enqueue(getMessage('ping', 'waiting'))
          }, 60000)
          while(true) {
            const { done, value } = await reader.read()
            if(done) {
              break;
            }
            controller.enqueue(value)
          }
          reader.releaseLock()
        }, 
        cancel(){
          if (typeof timerId === "number") {
            clearInterval(timerId);
          }
        } 
      })
      return new Response(body, init)
    },
  }
}
