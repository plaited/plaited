/* eslint-disable @typescript-eslint/no-explicit-any */
import express, { Express, Request, Response, Router } from 'express'

export class Server {
  app: Express
  routes: Router[]
  constructor() {
    this.app = express()
    this.routes = []
  }

  add(path: string, callback: (req: Request, res: Response) => void) {
    const router = Router()
    router.get(path, callback)
    this.app.use(router)
    this.routes.push(router)
  }

  remove(path: string) {
    const index = this.routes.findIndex((router: any) => router.stack[0].route.path === path)
    if (index !== -1) {
      this.routes.splice(index, 1)
    }
    this.app._router.stack.forEach((route: any, i: number, routes: any[]) => {
      if (route.route && route.route.path === path) {
        routes.splice(i, 1)
      }
    })
  }
}
