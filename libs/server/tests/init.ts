import { server } from '../server.ts'
import { ssr } from './ssr.ts'
import { Routes } from '../types.ts'

const __dirname = new URL('.', import.meta.url).pathname

const routes = {
  '/': () => ssr('<link rel="stylesheet" href="./styles.css"><h1>Home</h1>'),
  '/about': () =>
    ssr('<link rel="stylesheet" href="./styles.css"><h1>About</h1>'),
  '/contact': () =>
    ssr('<link rel="stylesheet" href="./styles.css"><h1>Contact</h1>'),
}

const { updateRoutes } = await server({
  root: `${__dirname}/assets`,
  routes,
})

setTimeout(() => {
  updateRoutes((oldRoutes: Routes) => ({
    ...oldRoutes,
    '/help': () =>
      ssr('<link rel="stylesheet" href="./new-styles.css"><h1>Help</h1>'),
  }))
}, 5000)
