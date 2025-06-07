import { workshop, DEFAULT_PLAY_TIMEOUT } from 'plaited/workshop'
import { useSignal } from 'plaited/behavioral'
import { chromium, type BrowserContext } from 'playwright'

const cwd = `${process.cwd()}/src`
const output = `${process.cwd()}/.plaited`
const stories = await workshop({ cwd, output })

// const browser = await chromium.launch()
// const contexts = new Set<BrowserContext>()

// await Promise.allSettled(
//   [...stories].map(async ([route, params]) => {
//     const context = await browser.newContext()
//     /**
//      * count of routes
//      * send message to module as a trigger
//      * once count is done we want to close all browser context we can use useSignal for that.
//      */
//     contexts.add(context)
//     const page = await context.newPage()
//     await page.goto(`http://localhost:${port}${route}`)

//     page.on('console', async (msg) => {
//       if (msg.type() === 'dir') {
//         const args = await Promise.all(msg.args().map((arg) => arg.jsonValue()))
//         console.log(`[Page: ${route}] console.dir:`, ...args)
//       }
//     })

//     setTimeout(async () => {
//       console.log(`Closing context for page ${route} after 5 seconds.`)
//       try {
//         await context.close()
//       } catch (e) {
//         console.error(`Error closing context for ${route}:`, e)
//       } finally {
//         contexts.delete(context)
//       }
//     }, 5000)
//   }),
// )
