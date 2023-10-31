/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { TestResultError, TestResult, BrowserSessionResult } from '@web/test-runner-core/browser/session.js'
import { assert, Assertion, AssertionError } from './assert.js'

type TestCallback = (t: Assertion) => Promise<void> | void

interface Test {
  (name: string, cb: TestCallback): void
  skip: (name: string, cb: TestCallback) => void
}

type TestCase = () => Promise<boolean> | boolean

class TestRunner {
  #completedTests = 0
  #failedTests = 0
  #errors: TestResultError[] = []
  #cases: TestCase[] = []
  #timeout = 5_000
  #tests: TestResult[] = []
  updateTimeout(time: number) {
    this.#timeout = time
  }
  get timeout() {
    return this.#timeout
  }
  addCase(test: TestCase) {
    this.#cases.push(test)
  }
  addResult(result: TestResult) {
    this.#tests.push(result)
  }
  addError(obj: TestResultError) {
    this.#errors.push(obj)
  }
  async run(name: string) {
    for (const testCase of this.#cases) {
      try {
        const passed = await testCase()
        this.#completedTests++
        if (!passed) {
          this.#failedTests++
        }
      } catch (error) {
        console.error(error)
      }
    }

    if (this.#completedTests === this.#cases.length) {
      const results: BrowserSessionResult = {
        passed: !this.#failedTests,
        testResults: {
          name,
          suites: [],
          tests: this.#tests,
        },
        errors: this.#errors,
      }
      return results
    } else {
      throw new AssertionError(`Not all test completed`)
    }
  }
}

declare global {
  interface Window {
    __rite_test_runner?: TestRunner
  }
}

window.__rite_test_runner = new TestRunner()

const throwTimeoutError = async () => {
  const timeout = window.__rite_test_runner.timeout
  await assert.wait(timeout)
  throw new Error(`test takes longer than ${timeout}ms to complete`)
}

export const test: Test = (name, callback) => {
  window.__rite_test_runner.addCase(async () => {
    const startTime = performance.now()
    const result: TestResult = {
      name,
      passed: true,
      skipped: false,
    }
    try {
      await Promise.race([callback(assert), throwTimeoutError()])
      const msg = `✓ ${name}`
      // eslint-disable-next-line no-console
      console.log(msg)
    } catch (error) {
      const msg = `✗ ${name}`
      // eslint-disable-next-line no-console
      console.log(msg)
      result.passed = false
      if (error instanceof AssertionError) {
        const obj: Pick<TestResultError, 'actual' | 'expected' | 'message'> = JSON.parse(error.message)
        result.error = { name, stack: `${error.stack}`, ...obj }
        window.__rite_test_runner.addError({ name, ...obj })
      } else {
        throw new Error(error)
      }
    }
    result.duration = performance.now() - startTime
    window.__rite_test_runner.addResult(result)
    return result.passed
  })
}
test.skip = (name: string, _: TestCallback) => {
  window.__rite_test_runner.addCase(() => {
    const result = {
      name,
      passed: true,
      skipped: true,
    }
    window.__rite_test_runner.addResult(result)
    return true
  })
}
