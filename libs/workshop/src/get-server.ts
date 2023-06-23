import express, { Request, Response, Router } from 'express'
import path from 'node:path'
import net from 'node:net'
import chokidar from 'chokidar'
import { GetServer, CustomResponse } from './types.js'

export const getServer: GetServer = async ({
  assets,
  reload,
  srcDir,
  rebuild,
  port: _port,
}) => {
  let port = _port
  const app = express()
  const routes = new Map<string, Router>()
  assets && app.use(express.static(path.join(process.cwd(), assets)))

  const add = (path: string, callback: (req: Request, res: Response | CustomResponse) => void) =>{
    const router = Router()
    router.get(path, callback)
    app.use(router)
    routes.set(path, router)
  }

  const findOpenPort = async ()  =>{
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.on('error', reject)
      server.listen(port, () => {
        const { port } = server.address() as net.AddressInfo
        server.close(() => {
          resolve(port)
        })
      })
    }).catch(() => {
      port = port + 1
      findOpenPort()
    })
  }

  const start = () => {
    findOpenPort().then(openPort => {
      app.listen(openPort, () => {
        console.log(`Server listening on port ${openPort}`)
      })
    })
  }

  // Build test and pages
  await rebuild(add)

  if (reload && srcDir) {
    add('/livereload', (_: Request, res: CustomResponse) => {
      res.sseSetup()
    })
    let count = 0
    chokidar.watch(srcDir).on('all', async () => {
      // Rebuild test and pages
      await rebuild(add)
      // Get livereload route
      const route = routes.get('/livereload')
      const callback = route.stack[0].handle // get the callback function
      const req = {} as Request
      const res = {
        sseSetup() {
          this.setHeader('Content-Type', 'text/event-stream')
          this.setHeader('Cache-Control', 'no-cache')
          this.setHeader('Connection', 'keep-alive')
          this.flushHeaders()
        },
        sseSend() {
          count = count + 1
          this.write(`reload: ${count}\n\n`)
        },
      } as unknown as CustomResponse
    
      callback(req, res) // execute the callback
      res.sseSend() 
    })
  }

  return  { start, port }
}
