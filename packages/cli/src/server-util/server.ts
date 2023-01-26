/* eslint-disable no-console */
import http, { ServerResponse } from 'http'
import http2 from 'http2'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { router } from './router.js'
import { usePort, fileWatch, networkIps, sendMessage } from './utils.js'
import { getFileRoutes } from './get-file-routes.js'
import { getReloadRoute } from './get-reload-route.js'
import { Server, ServerCallback } from './types.js'

export const server: Server = async ({
  root: _root = '.',
  routes,
  port:_port,
  reload = true,
  credentials,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) =>{
  console.time('startup')
  // Try start on specified port then fail or find a free port
  let port: number
  try {
    port = await usePort(_port || parseInt(process.env.PORT ?? '', 10) || 3000)
  } catch (e) {
    if (_port || process.env.PORT) {
      console.error('[ERR] The port you have specified is already in use!')
      process.exit()
    }
    port = await usePort()
  }
  

  // Configure globals
  const root = _root.startsWith('/') ? _root  : path.join(process.cwd(), _root)

  if (!fs.existsSync(_root)) {
    console.error(`[ERR] Root directory ${root} does not exist!`)
    process.exit()
  }

  if (!fs.statSync(root).isDirectory()) {
    console.error(`[ERR] Root directory "${root}" is not directory!`)
    process.exit()
  }

  const reloadClients:ServerResponse[]  = []
  const protocol = credentials ? 'https' : 'http'
  const createServer = credentials && reload
    ? (cb: ServerCallback) => https.createServer(credentials, cb)
    : credentials
    ? () => http2.createSecureServer(credentials)
    : (cb: ServerCallback) => http.createServer(cb)

  // Get file assets routes
  const fileRoutes = await getFileRoutes(root)

  if(credentials && !reload) {
    // createServer()
  } else {
    createServer(async( req, res) => {
      router(
        {
          ...fileRoutes,
          ...routes,
          ...getReloadRoute(reload, reloadClients),
        },
        otherHandler,
        errorHandler,
        unknownMethodHandler
      )(req, res)
    }).listen(port, () => {
      console.log(`Server running at: ${protocol}://localhost:${port}`)
      console.timeEnd('startup')
    })
  }

  
  // Notify livereload reloadClients on file change
  const sendReloadMessage = () => {
    while (reloadClients.length > 0) {
      sendMessage(reloadClients.pop() as ServerResponse, 'message', 'reload')
    }
  }
  reload && await fileWatch(root, () => { sendReloadMessage() })

  // Close socket connections on sigint
  process.on('SIGINT', () => {
    while (reloadClients.length > 0) (reloadClients.pop() as ServerResponse).end()
    process.exit()
  })

  return {
    ips: networkIps,
    port,
    protocol,
    root,
    sendReload: reload ? sendReloadMessage : undefined,
    url: `${protocol}://localhost:${port}`,
  }
}
