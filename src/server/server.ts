/* eslint-disable no-console */
// import http2 from 'http2'
import { router } from './router.ts'
import { usePort, networkIps } from './utils.ts'
import { getFileRoutes } from './get-file-routes.ts'
import { getReloadRoute, getMessage } from './get-reload-route.ts'
import { Routes, Server } from './types.ts'
import { createServer } from '../deps.ts'
export const server: Server = async ({
  root,
  routes,
  port:_port = 3000,
  reload = true,
  credentials,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) =>{
  // Try start on specified port then fail or find a free port
  const port = usePort(_port) ? _port : usePort()
  

  // Configure globals
  if (!Deno.statSync(root)) {
    console.error(`[ERR] Root directory ${root} does not exist!`)
    Deno.exit()
  }

  if (!Deno.statSync(root).isDirectory) {
    console.error(`[ERR] Root directory "${root}" is not directory!`)
    Deno.exit()
  }
  
  const reloadClients:WritableStreamDefaultWriter[]  = []
  const protocol = credentials ? 'https' : 'http'

   // Get file assets routes
   const fileRoutes = await getFileRoutes(root)

   const stream = new TransformStream({
    transform(chunk, controller) {
      const { channel, data } = chunk;
      controller.enqueue(getMessage(channel, data));
    },
  })
  const reader = stream.readable.getReader()
  const writer  = stream.writable.getWriter();

  createServer(router(
    {
      ...fileRoutes,
      ...routes,
      ...getReloadRoute(reload, reader),
    },
    otherHandler,
    errorHandler,
    unknownMethodHandler
  ), {
    port
  })
  
  if(reload) {
    const watcher = Deno.watchFs(root)
    for await (const event of watcher) {
      if(['any', 'access'].includes(event.kind)) continue
      writer.write({ channel: 'message', data: 'reload' });
    }
  }

  // Close socket connections on sigint
  Deno.addSignalListener("SIGINT", () => {
    console.log("interrupted!");
    Deno.exit();
  });
  const addRoutes = (additions: Routes) => {
    Object.assign(routes, additions)
  }

  return {
    ips: networkIps,
    port,
    protocol,
    root,
    sendReload: reload ? sendReloadMessage : undefined,
    addRoutes,
    url: `${protocol}://localhost:${port}`,
  }
}
