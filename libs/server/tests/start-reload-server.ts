import { helpHandler, homeHandler, root } from './utils.ts'
import { server } from '../server.ts'
import { getFileHandler } from '../get-file-handler.ts'

const routes = new Map()
routes.set('/', homeHandler)
routes.set('/help', helpHandler)

await server({
  root,
  port: 9000,
  routes,
  reload: true,
  middleware: (handler) => async (req, ctx) => {
    console.log(req.url)
    const res = await getFileHandler({ assets: root, req })
    if (res) {
      return res
    }
    return await handler(req, ctx)
  },
})
Deno.addSignalListener('SIGTERM', () => {
  Deno.exit()
})
