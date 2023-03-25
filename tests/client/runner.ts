import { assert, Assertion, AssertionError } from '$assert'

import { TestCallback } from './type.ts'

/** open web socket connection */
const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i
const host = document.URL.replace(hostRegex, '$1')

/** Fetching test pass */
let data: string[] = []
try {
  const res = await fetch(`${host}/tests`, {
    method: 'GET',
  })
  data = await res.json()
} catch (err) {
  console.error(err)
}

function getPage(urlString: string) {
  // Create a new URL object
  const url = new URL(urlString)

  // Get the pathname and split it using '/'
  const pathParts = url.pathname.split('/')

  // Remove the last element (the filename)
  pathParts.pop()

  // Extract the last directory
  return pathParts[pathParts.length - 1]
}

/** import tests */
const tests: { page: string; testCallback: TestCallback; name: string }[] = []
try {
  await Promise.all(data.map(async (path) => {
    const testGroups = await import(`${host}${path}`)
    const page = `${host}/${getPage(`${host}${path}`)}`
    for (const name in testGroups) {
      const testCallback = testGroups[name]
      tests.push({ page, testCallback, name })
    }
  }))
} catch (err) {
  console.error(err)
}

/** test shouldn't take more than 5 seconds */
const throwTimeoutError = async () => {
  const timeout = 5_000
  await assert.wait(5_000)
  throw new AssertionError(`test takes longer than ${timeout}ms to complete`)
}

let passed = 0
let failed = 0

const fixture = document.getElementById('fixture')
const render = (id: string): Promise<HTMLBodyElement> => {
  const frame = document.createElement('iframe')
  frame.src = id
  fixture?.append(frame)
  const context = frame?.contentDocument?.body as HTMLBodyElement
  /** sometimes you need to wait for the next frame */
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve(context)
    })
  })
}

/** loop over tests imports */
console.log('RUN_START')

for (const { page, testCallback } of tests) {
  /** render iframe for isolated test group */
  const context = await render(page)
  try {
    await Promise.race([testCallback(assert, context), throwTimeoutError()])
    const msg = `✔ ${name}`
    console.log(msg)
    passed++
  } catch (error) {
    const msg = `✘ ${name} \n ${error.stack}`
    console.log(msg)
    failed++
  }
}
console.log('RUN_END')
console.log('ALI WUZ HERE')

console.log(`${passed} passed, ${failed} failed`)
