import { assert, Assertion, AssertionError } from '$assert'

type TestCallback = (assert: Assertion) => Promise<void> | void

/** open web socket connection */
const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i
const host = document.URL.replace(hostRegex, '$1')
const socket = new WebSocket(`ws://${host}/reporter`)

/** callback to send message to server */
const sendMsg = (msg: string) => {
  return socket.send(msg)
}

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

/** execute tests when connection is opened */
socket.addEventListener('open', async (_) => {
  sendMsg('RUN_START')
  let passed = 0
  let failed = 0
  /** loop over tests imports */
  for (const name in tests) {
    const callback = tests[name] as TestCallback

    try {
      await Promise.race([callback(assert), throwTimeoutError()])
      const msg = `✔ ${name}`
      sendMsg(msg)
      passed++
    } catch (error) {
      const msg = `✘ ${name} \n ${error.stack}`
      sendMsg(msg)
      failed++
    }
  }
  sendMsg('RUN_END')
  sendMsg(`${passed} passed, ${failed} failed`)
})
