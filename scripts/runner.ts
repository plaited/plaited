import puppeteer from 'puppeteer'
import { useTestServer } from '../src/workshop/use-test-server.js'
import { useSignal } from 'plaited/behavioral'
import { performance } from 'perf_hooks' // Import performance

const startTime = performance.now() // Start timer

const cwd = `${process.cwd()}/src`
const port = 3000
const { server, stories } = await useTestServer({ cwd, port })
const browser = await puppeteer.launch()
const running = useSignal(new Set(stories.keys()))
const flat = [...stories.values()].flat()

// await Promise.all(
//   stories.values().map(async (tests) => {
//     for (const { route } of tests) {
//       const page = await browser.newPage()
//       const url = `http://localhost:${server.port}${route}`
//       console.log(url)
//       await page.goto(url, { waitUntil: 'domcontentloaded' })
//       await page.close()
//     }
//   }),
// )

// for (const tests of stories.values()) {
//   await Promise.all(
//     tests.map(async ({ route }) => {
//       const page = await browser.newPage()
//       const url = `http://localhost:${server.port}${route}`
//       console.log(url)
//       await page.goto(url, { waitUntil: 'domcontentloaded' })
//       await page.close()
//     }),
//   )
// }
//
for (const { route } of flat) {
  const page = await browser.newPage()
  const url = `http://localhost:${server.port}${route}`
  console.log(url)
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.close()
}

// await Promise.all(
//   flat.map(async ({ route }) => {
//     const page = await browser.newPage()
//     const url = `http://localhost:${server.port}${route}`
//     console.log(url)
//     await page.goto(url, { waitUntil: 'domcontentloaded' })
//     await page.close()
//   }),
// )

console.log(flat)
const endTime = performance.now() // End timer
const duration = endTime - startTime
console.log(`Execution time: ${duration.toFixed(2)} ms`) // Log execution time, formatted to 2 decimal places

process.exit(0)
