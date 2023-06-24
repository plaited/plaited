import express, { Request, Response, NextFunction } from 'express'
import path from 'node:path'
import chokidar from 'chokidar'
import http from 'node:http'
import https from 'node:https'
import { GetServer, HandlerCallback } from './types.js'

// Utility function for sending SSE data to client
const sendMessage = (res:Response, channel: string, data: string) => {
  res.write(`event: ${channel}\nid: 0\ndata: ${data}\n`)
  res.write('\n\n')
}

export const getServer: GetServer = async ({
  assets,
  reload,
  srcDir,
  rebuild,
  port,
  sslCert,
}) => {
  const app = express()
  // Handler map where the key is the path and a callback is the Handler
  const handlers = new Map<string, HandlerCallback>()
  // Pass in a callback to handle story routes and JS bundle
  app.use((req: Request, res: Response, next: NextFunction) => {
    const handler = handlers.get(req.path)
    if (handler) {
      handler(req, res, next)
    } else {
      next()
    }
  })

  // If we have static files serve them
  assets && app.use(express.static(path.join(process.cwd(), assets)))

  // Build test and pages
  await rebuild(handlers)

  const reloadClients = new Set<Response>()
  if (reload && srcDir) {
    // Set livereload route
    handlers.set('/livereload', (_: Request, res: Response) => {
      res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
      })
      // FLush out message headers
      res.flushHeaders()
      // Send a connected message when connection established
      sendMessage(res, 'connected', 'ready')
      // Keep connection alive at 1 minute intervals
      const deadInterval = setInterval(sendMessage, 60_000, res, 'ping', 'waiting')
      // Add connected client to reloadClients set
      reloadClients.add(res)
      // When a client clearInterval & delete Response
      res.on('close', () => {
        clearInterval(deadInterval)
        reloadClients.delete(res)
      })
    })
    // Watch the source directory for changes
    chokidar.watch(srcDir).on('all', async () => {
      // Rebuild test and pages
      console.log('Rebuilding tests and pages...')
      await rebuild(handlers)

      // Notify livereload reloadClients on file change
      console.log('Reloading clients...')
      for(const client of reloadClients) {
        sendMessage(client, 'message', 'reload')
      }
    }).on('error', error => console.error(`Watcher error: ${error}`))

  }

  let server: http.Server | https.Server
  // Start server
  const start = async () => {
    server = sslCert 
      ? await https.createServer(sslCert, app).listen(port, () => {
        console.log(`Server running... https://localhost:${port}`)
      })
      : await http.createServer(app).listen(port, () => {
        console.log(`Server running... http://localhost:${port}`)
      })
  }
  // On SIGINT cleanup
  process.on('SIGINT', () => {
    for(const client of reloadClients) {
      client.end()
    }
    reloadClients.clear()
    server.close(() => {
      console.log('Server closed.')
      process.exit()
    })
  })

  return  start
}
