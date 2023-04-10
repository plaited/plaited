import { testRunner } from '$rite'
;(async () => {
  await testRunner.run(() => {
    testRunner.logResults()
  })
})()
