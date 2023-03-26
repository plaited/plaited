import { testRunner } from './test.ts'
;(async () => {
  await testRunner.run(() => {
    testRunner.logResults()
  })
})()
