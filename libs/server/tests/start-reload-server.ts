import { helpRoute, homeRoute, root } from './utils.ts'
import { start } from '../start.ts'
await start({
  root,
  port: 9000,
  routes: {
    ...homeRoute,
    ...helpRoute,
  },
})
