import { helpRoute, homeRoute, root } from './utils.ts'
import { server } from '../server.ts'
await server({
  root,
  port: 9000,
  routes: {
    ...homeRoute,
    ...helpRoute,
  },
})
