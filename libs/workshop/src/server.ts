/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Express, Request, Response, Router, IRouter } from 'express'
import path from 'node:path'

export class Server {
  app: Express
  routes = new Map<string, Router>()
  constructor(assets?: string, reload?: boolean) {
    this.app = express()
    assets && this.app.use(express.static(path.join(process.cwd(), assets)))
  }

  set(path: string, callback: (req: Request, res: Response) => void) {
    const router = Router()
    router.get(path, callback)
    this.app.use(router)
    this.routes.set(path, router)
  }

  has(path: string) {
    return this.routes.has(path)
  }

  delete(path: string) {
    this.routes.delete(path)
    this.app._router.stack.forEach((route: any, i: number, routes: any[]) => {
      if (route.route && route.route.path === path) {
        routes.splice(i, 1)
      }
    })
  }
}
