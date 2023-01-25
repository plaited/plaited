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
  port:_port,
  root: _root = '.',
  reload = true,
  credentials,
  routes,
  assets: _assets = _root,
}) =>{
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
  const assets = _assets === _root
    ? root
    :_assets.startsWith('/') 
    ? _assets
    : path.join(process.cwd(), _assets)

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
  const fileRoutes = await getFileRoutes(assets)

  if(credentials && !reload) {
    // createServer()
  } else {
    createServer(async( req, res) => {
      const init = router({
        ...fileRoutes,
        ...routes,
        ...getReloadRoute(reload, reloadClients),
      })
      init(req, res)
    })
  }

  
  // Notify livereload reloadClients on file change

  reload && await fileWatch(root, () => {
    while (reloadClients.length > 0) {
      sendMessage(reloadClients.pop() as ServerResponse, 'message', 'reload')    
    }
  })

  // Close socket connections on sigint

  process.on('SIGINT', () => {
    while (reloadClients.length > 0) (reloadClients.pop() as ServerResponse).end()
    process.exit()
  })

  const x = { url: `${protocol}://localhost:${port}` }
  return { ...x, root, protocol, port: port, ips: networkIps }
}
