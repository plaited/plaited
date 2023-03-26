import { assert, Assertion } from '$assert'

export type TestCallback = (t: Assertion) => Promise<void> | void

export const test = async (name: string, cb: TestCallback) => {
  try {
    await cb(assert)
    const msg = `✔ ${name}`
    console.log(msg)
  } catch (error) {
    const msg = `✘ ${name} \n ${error.stack}`
    console.log(msg)
  }
}
