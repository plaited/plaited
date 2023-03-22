import { assert, Assertion, AssertionError } from '$assert'

type TestCallback = (assert: Assertion) => Promise<void> | void

/** open web socket connection */
const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i
const host = document.URL.replace(hostRegex, '$1')

/** import tests */
const tests = await import(
  `http://${host}/spec.js`
)

/** test shouldn't take more than 5 seconds */
const throwTimeoutError = async () => {
  const timeout = 5_000
  await assert.wait(5_000)
  throw new AssertionError(`test takes longer than ${timeout}ms to complete`)
}

let passed = 0
let failed = 0

/** loop over tests imports */
console.log('RUN_START')
for (const name in tests) {
  const callback = tests[name] as TestCallback

  try {
    await Promise.race([callback(assert), throwTimeoutError()])
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

console.log(`${passed} passed, ${failed} failed`)
