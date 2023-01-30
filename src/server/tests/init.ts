import { server } from '../server.ts'
import { ssr } from './ssr.ts'
import { HandlerContext } from '../types.ts'

const __dirname = new URL('.', import.meta.url).pathname;

const routes = {
  '/': (req: Request, ctx: HandlerContext) => ssr('<link rel="stylesheet" href="./styles.css"><h1>Home</h1>'),
  '/about': (req: Request, ctx: HandlerContext) => ssr('<link rel="stylesheet" href="./styles.css"><h1>About</h1>'),
  '/contact': (req: Request, ctx: HandlerContext) => ssr('<link rel="stylesheet" href="./styles.css"><h1>Contact</h1>'),
}


const { addRoutes } = await server({
  root: `${__dirname}/assets`,
  routes,
})

setTimeout(() => addRoutes(
  { '/help': (req: Request, ctx: HandlerContext) => ssr('<h1>Help</h1>'),
  }
), 5000)
