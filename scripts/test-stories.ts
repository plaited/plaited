import { behavioral } from 'plaited/behavioral'
import type { RunnerMessage } from 'plaited/testing'
import { TEST_RUNNER_EVENTS } from './test-runner/test-runner.constants.js'
import { testRunner } from './test-runner/test-runner.js'
import { useTestServer } from './test-runner/use-test-server.js'

const root = `${process.cwd()}/src`
const { trigger, useFeedback } = behavioral()
const { storyServer, storyParamSet, reloadStoryClients } = await useTestServer({
  root,
  trigger,
})

const runnerTrigger = await testRunner({
  serverURL: storyServer.url,
})

if (process.execArgv.includes('--hot')) {
  reloadStoryClients()
}

useFeedback({
  [TEST_RUNNER_EVENTS.on_runner_message](detail: RunnerMessage) {
    runnerTrigger({ type: TEST_RUNNER_EVENTS.on_runner_message, detail })
  },
})

runnerTrigger({
  type: TEST_RUNNER_EVENTS.run_tests,
  detail: { storyParams: storyParamSet.get(), colorSchemeSupport: false },
})
