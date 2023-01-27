import { IncomingMessage, ServerResponse } from 'http'
import { fileURLToPath } from 'url'
import path from 'path'
import { server } from '../server.js'
import { ssr } from './ssr.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const routes = {
  '/': (req: IncomingMessage, ctx: ServerResponse) => ssr(ctx, '<h1>Home</h1>'),
  '/about': (req: IncomingMessage, ctx: ServerResponse) => ssr(ctx, '<h1>About</h1>'),
  '/contact': (req: IncomingMessage, ctx: ServerResponse) => ssr(ctx, '<h1>Contact</h1>'),
}

const { addRoutes } = await server({
  root: path.resolve(__dirname),
  routes,
})

setTimeout(() => addRoutes(
  { '/help': (req: IncomingMessage, ctx: ServerResponse) => ssr(ctx, '<h1>Help</h1>'),
  }
), 5000)
