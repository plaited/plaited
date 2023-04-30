import { helpHandler, homeHandler, newStyles, root } from './utils.ts'
import { server } from '../server.ts'
import { getFileHandler } from '../get-file-handler.ts'
import { wait } from '../../utils/wait.ts'
const routes = new Map()
routes.set('/', homeHandler)
routes.set('/help', helpHandler)

const { close } = await server({
  root,
  port: 9000,
  routes,
  reload: true,
  middleware: handler => async (req, ctx) => {
    const res = await getFileHandler({ assets: root, req })
    if (res) {
      return res
    }
    return await handler(req, ctx)
  },
})
const socket = new WebSocket('ws://localhost:9000/livereload')
await Deno.writeTextFile(`${root}/new-styles.css`, newStyles)
await wait(500)
await Deno.remove(`${root}/new-styles.css`)
try {
  socket.close()
} catch (e) {
  console.log(e)
}
await close()
Deno.exit(0)
