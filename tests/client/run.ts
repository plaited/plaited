import { assert, Assertion } from '$assert'

type TestCallback = (assert: Assertion) => Promise<void> | void

/** Open web socket */
const hostRegex = /^https?:\/\/([^\/]+)\/.*$/i
const host = document.URL.replace(hostRegex, '$1')
const socket = new WebSocket(`ws://${host}/reporter`)

const sendMsg = (msg: string) => {
  return socket.send(msg)
}
console.log(`${host}/calculator.spec.js`)
const tests = await import(
  `http://${host}/calculator.spec.js`
)

// /** execute tests */
socket.addEventListener('open', async (_) => {
  sendMsg('RUN_START')
  let passed = 0
  let failed = 0
  for (const name in tests) {
    const callback = tests[name] as TestCallback

    try {
      await callback(assert)
      const msg = `✔ ${name}`
      console.log(msg)
      sendMsg(msg)
      passed++
    } catch (error) {
      const msg = `✘ ${name} \n ${error.stack}`
      console.log(msg)
      sendMsg(msg)
      sendMsg(error)
      failed++
    }
  }
  sendMsg(`${passed} passed, ${failed} failed`)
  sendMsg('RUN_END')
})
