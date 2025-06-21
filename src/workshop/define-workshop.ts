import { useSignal } from '../behavioral/use-signal.js'
import { keyMirror } from '../utils/key-mirror.js'
import { defineBProgram } from '../behavioral/define-b-program.js'
import { useStoryServer } from './story-server/use-story-server.js'
import { storyRunner } from './story-runner/story-runner.js'

export type DefineWorkshopParams = {
  cwd: string
}

export const PUBLIC_EVENTS = keyMirror(
  'test_story_set',
  'test_all_stories',
  'get_play_story_sets',
  'get_file_routes',
  'set_current_working_directory',
  'set_test_background_style',
  'set_test_page_color_style',
  'set_design_tokens',
  'get_design_token_entry',
  'get_filtered_design_token_entries',
  'get_all_design_token_entries',
  'check_if_design_token_exist',
  'list_routes',
)

const PRIVATE_EVENTS = keyMirror('reload_server')

export type WorkshopDetails = {
  [PRIVATE_EVENTS.reload_server]: void
  [PUBLIC_EVENTS.list_routes]: void
  [PUBLIC_EVENTS.test_all_stories]: void
}

export const defineWorkshop = defineBProgram<WorkshopDetails, DefineWorkshopParams>({
  publicEvents: Object.values(PUBLIC_EVENTS),
  async bProgram({ cwd }) {
    const designTokens = useSignal<string>()

    const { server, reload, storyParamSet, reloadClients } = await useStoryServer({
      cwd,
      designTokens,
    })

    const colorSchemeSupportSignal = useSignal(false)

    await storyRunner({
      colorSchemeSupportSignal,
      serverURL: server.url,
      storyParamSet,
    })

    if (process.execArgv.includes('--hot')) {
      reloadClients()
    }
    return {
      async [PUBLIC_EVENTS.test_all_stories]() {
        storyParamSet.set(new Set(storyParamSet.get()))
      },
      async [PRIVATE_EVENTS.reload_server]() {
        await reload()
      },
      async [PUBLIC_EVENTS.list_routes]() {
        for (const { route, filePath } of storyParamSet.get()) {
          const hrefs = `  ${new URL(route, server.url).href}`
          console.log(`${filePath}:\n${hrefs}`)
        }
      },
    }
  },
})
