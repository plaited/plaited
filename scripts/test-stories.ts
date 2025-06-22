import { STORY_RUNNER_EVENTS } from '../src/workshop/story-runner/story-runner.constants.js'
import { storyRunner } from '../src/workshop/story-runner/story-runner.js'
import { useStoryServer } from '../src/workshop/story-server/use-story-server.js'

const cwd = `${process.cwd()}/src`

const { storyServer, storyParamSet, reloadStoryClients } = await useStoryServer(cwd)

const trigger = await storyRunner({
  serverURL: storyServer.url,
  storyParamSet,
})

if (process.execArgv.includes('--hot')) {
  reloadStoryClients()
}

trigger({ type: STORY_RUNNER_EVENTS.run_tests, detail: storyParamSet.get() })
