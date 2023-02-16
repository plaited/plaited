import { start } from '../start.ts'
import { ssr } from './ssr.ts'

const __dirname = new URL('.', import.meta.url).pathname

const routes = {
  '/': () => ssr('<link rel="stylesheet" href="./styles.css"><h1>Home</h1>'),
  '/about': () =>
    ssr('<link rel="stylesheet" href="./styles.css"><h1>About</h1>'),
  '/contact': () =>
    ssr('<link rel="stylesheet" href="./styles.css"><h1>Contact</h1>'),
}

let { close } = await start({
  dev: true,
  root: `${__dirname}/assets`,
  routes,
})

await close()
;({ close } = await start({
  dev: true,
  root: `${__dirname}/assets`,
  routes: {
    ...routes,
    '/help': () =>
      ssr('<link rel="stylesheet" href="./new-styles.css"><h1>Help</h1>'),
  },
}))

await close()
await start({
  dev: true,
  root: `${__dirname}/assets`,
  routes: {
    ...routes,
    '/blog': () =>
      ssr('<link rel="stylesheet" href="./new-styles.css"><h1>Blog</h1>'),
  },
})
