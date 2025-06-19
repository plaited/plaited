import { bProgram } from '../behavioral/b-program.js'
import { getPublicTrigger } from '../behavioral/get-public-trigger.js'
import { useSignal } from '../behavioral/use-signal.js'
import { keyMirror } from '../utils/key-mirror.js'
import { useServer } from './routing/use-server.js'
import { defineTesting  } from './testing/define-testing.js'

export type DefineWorkshopParams = {
  cwd: string
  port?: number
  development?: Bun.ServeOptions['development']
}

export const PUBLIC_EVENTS = keyMirror(
  'TEST_STORY_SET',
  'TEST_ALL_STORIES',
  'GET_PLAY_STORY_SETS',
  'GET_FILE_ROUTES',
  'SET_CURRENT_WORKING_DIRECTORY',
  'SET_TEST_BACKGROUND_STYLE',
  'SET_TEST_PAGE_COLOR_STYLE',
  'SET_DESIGN_TOKENS',
  'GET_DESIGN_TOKEN_ENTRY',
  'GET_FILTERED_DESIGN_TOKEN_ENTRIES',
  'GET_ALL_DESIGN_TOKEN_ENTRIES',
  'CHECK_IF_DESIGN_TOKEN_EXIST',
  'LIST_ROUTES',
)

const EVENTS = keyMirror('RELOAD_SERVER')

export type WorkshopDetails = {
  [EVENTS.RELOAD_SERVER]: void
  [PUBLIC_EVENTS.LIST_ROUTES]: void
  [PUBLIC_EVENTS.TEST_ALL_STORIES]: void
}

export const defineWorkshop = async ({
  cwd,
  development = false,
  port = 3000,
}: DefineWorkshopParams) => {
  const { useFeedback, trigger } = bProgram()

  const designTokensSignal = useSignal<string>()


  const { url, reload, storyParamSetSignal, reloadClients } = await useServer({
    cwd,
    development,
    port,
    designTokensSignal,
  })
 
  const colorSchemeSupportSignal = useSignal(false)
  
  await defineTesting({
    colorSchemeSupportSignal,
    serverURL: url,
    storyParamSetSignal
  })

  if (process.execArgv.includes('--hot')) {
    console.log('...reloading')
    reloadClients()
  } 

  useFeedback<WorkshopDetails>({
    async [PUBLIC_EVENTS.TEST_ALL_STORIES]() {
      storyParamSetSignal.set(new Set(storyParamSetSignal.get()))
    },
    async [EVENTS.RELOAD_SERVER]() {
      await reload()
    },
    async [PUBLIC_EVENTS.LIST_ROUTES]() {
      const storyParamSet = storyParamSetSignal.get()
      for (const { route, filePath} of storyParamSet) {
        const hrefs = `  ${new URL(route, url).href}`
        console.log(`${filePath}:\n${hrefs}`)
      }
    },
  })

  return getPublicTrigger({ trigger, publicEvents: Object.values(PUBLIC_EVENTS) })
}
