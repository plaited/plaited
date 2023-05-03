import {
  getConfig,
  sessionStarted,
  sessionFinished,
  sessionFailed,
} from '@web/test-runner-core/browser/session.js'

type TestFrameworkConfig = {
  path: string
  config: {
    timeout?: number
  }
}

(async () => {
  // notify the test runner that we're alive
  sessionStarted()

  // fetch the config for this test run, this will tell you which file we're testing
  const { testFile, testFrameworkConfig } = await getConfig()

  const failedImports = []

  // load the test file as an es module
  await import(new URL(testFile, document.baseURI).href).catch(error => {
    failedImports.push({ file: testFile, error: { message: error.message, stack: error.stack } })
  })

  const timeout = (testFrameworkConfig as TestFrameworkConfig['config'])?.timeout
  timeout && window.__rite_test_runner?.updateTimeout(timeout)

  const { pathname } = new URL(testFile, 'http://dummy.base')

  try {
    // run the actual tests, this is what you need to implement
    const testResults = await window.__rite_test_runner.run(pathname)

    // notify tests run finished
    sessionFinished({
      passed: failedImports.length === 0 && testResults.passed,
      ...testResults,
    })
  } catch (error) {
    // notify an error occurred
    sessionFailed(error)
    return
  }
})()
