// const locateOnFS = map((message) => {
//   if (message.data?.pass !== false) {
//     return message
//   }

//   const { at, ...restOfData } = message.data
//   const { pathname } = new URL(at)
//   const onFS = new URL(pathname, pathToFileURL(process.cwd()))

//   return {
//     ...message,
//     data: {
//       ...restOfData,
//       at: onFS,
//     },
//   }
// })

// async function* streamRunFromSocket(socket) {
//   const buffer = []
//   let done = false
//   let release
//   try {
//     socket.on('message', listener)

//     while (true) {
//       if (done) {
//         break
//       }
//       const message = buffer.shift()
//       if (message) {
//         yield message
//       } else {
//         await new Promise((resolve) => (release = resolve))
//       }
//     }
//   } finally {
//     socket.off('message', listener)
//   }

//   function listener(message) {
//     const messageObj = JSON.parse(message)

//     if (messageObj.type === 'RUN_END') {
//       done = true
//     }

//     buffer.push(messageObj)
//     release?.()
//   }
// }

export const getWebSocket = (req: Request) => {
  const upgrade = req.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() != 'websocket') {
    return new Response('request isn\'t trying to upgrade to websocket.')
  }
  const { socket, response } = Deno.upgradeWebSocket(req)
  socket.onopen = () => console.log('client connected')
  socket.onmessage = (e) => {
    console.log('socket message:', e.data)
    socket.send(new Date().toString())
  }
  //@ts-ignore: it exists
  socket.onerror = (e) => console.log('socket errored:', e.message)
  socket.onclose = () => console.log('client disconnected')
  return response
}
