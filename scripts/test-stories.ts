import { STORY_RUNNER_EVENTS } from '../src/workshop/story-runner/story-runner.constants.js'
import { storyRunner } from '../src/workshop/story-runner/story-runner.js'
import { useStoryServer } from '../src/workshop/story-server/use-story-server.js'
import { bProgram } from '../src/behavioral.js'
import type { RunnerMessage } from '../src/workshop.js'

const root = `${process.cwd()}/src`
const { trigger, useFeedback } = bProgram()
const { storyServer, storyParamSet, reloadStoryClients } = await useStoryServer({
  root,
  trigger,
})

const runnerTrigger = await storyRunner({
  serverURL: storyServer.url,
})

if (process.execArgv.includes('--hot')) {
  reloadStoryClients()
}

useFeedback({
  [STORY_RUNNER_EVENTS.on_runner_message](detail: RunnerMessage) {
    runnerTrigger({ type: STORY_RUNNER_EVENTS.on_runner_message, detail })
  },
})

runnerTrigger({
  type: STORY_RUNNER_EVENTS.run_tests,
  detail: { storyParams: storyParamSet.get(), colorSchemeSupport: false },
})
