import { helpHandler, homeHandler, root } from './utils.ts'
import { server } from '../server.ts'

const routes = new Map()
routes.set('/', homeHandler)
routes.set('/help', helpHandler)

await server({
  root,
  port: 9000,
  routes,
})
