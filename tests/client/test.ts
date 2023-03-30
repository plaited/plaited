import { assert, Assertion } from '$assert'

class TestRunner {
  #testCases: (() => Promise<boolean>)[] = []
  #completedTests = 0
  #passedTests = 0
  #failedTests = 0
  #allTestsDoneCallback: () => void

  add(testCase: () => Promise<boolean>) {
    this.#testCases.push(testCase)
  }

  async run(onAllTestsDone?: () => void) {
    this.#allTestsDoneCallback = onAllTestsDone || (() => {})
    for (const testCase of this.#testCases) {
      const result = await testCase()
      this.#completedTests++
      if (result) {
        this.#passedTests++
      } else {
        this.#failedTests++
      }
      if (this.#completedTests === this.#testCases.length) {
        this.#allTestsDoneCallback()
      }
    }
  }

  logResults() {
    console.log(`${this.#passedTests} passed, ${this.#failedTests} failed`)
  }
}

export const testRunner = new TestRunner()

type TestCallback = (t: Assertion) => Promise<void> | void

export const test = (name: string, cb: TestCallback) => {
  testRunner.add(async () => {
    let success = false
    try {
      await cb(assert)
      success = true
      const msg = `✔ ${name}`
      console.log(msg)
    } catch (error) {
      const msg = `✘ ${name} \n ${error.stack}`
      console.error(msg)
    }

    return success
  })
}