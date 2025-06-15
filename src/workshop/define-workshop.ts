import type { BPEvent } from '../behavioral/b-thread.js'
import { type Disconnect, type Handlers, bProgram } from '../behavioral/b-program.js'
import { useSignal } from '../behavioral/use-signal.js'
import { Glob } from 'bun'
import type { StoryObj } from './testing/plaited-fixture.types.js'
import type { DefineWorkshopParams, TestParams } from './workshop.types.js'
import { keyMirror } from '../utils/key-mirror.js'
// import { getPublicTrigger } from './get-public-trigger.js'
// import { getPlaitedTrigger } from './get-plaited-trigger.js'
import { startServer } from './routing/start-server.js'
import { bSync, getPublicTrigger } from 'plaited/behavioral'

export type DefineWorkshopParams = {
  cwd: string
  port?: number
  publicEvents?: string[]
  development?: Bun.ServeOptions['development']
} & Omit<PageOptions, 'output'>

const PUBLIC_EVENTS = keyMirror(
  'TEST_STORY_SET',
  'TEST_ALL_STORY_SETS',
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
)

const EVENTS = keyMirror('RELOAD_SERVER')

export type WorkshopHandlers = Handlers<{
  [PUBLIC_EVENTS.TEST_STORY_SET]: string
  [PUBLIC_EVENTS.TEST_ALL_STORY_SETS]: void
  [EVENTS.RELOAD_SERVER]: void
  [PUBLIC_EVENTS.SET_TEST_BACKGROUND_STYLE]: string
  [PUBLIC_EVENTS.SET_TEST_PAGE_COLOR_STYLE]: string
  [PUBLIC_EVENTS.SET_DESIGN_TOKENS]: string
  [PUBLIC_EVENTS.GET_DESIGN_TOKEN_ENTRY]: string
  [PUBLIC_EVENTS.GET_FILTERED_DESIGN_TOKEN_ENTRIES]: string
  [PUBLIC_EVENTS.GET_ALL_DESIGN_TOKEN_ENTRIES]: string
  [PUBLIC_EVENTS.CHECK_IF_DESIGN_TOKEN_EXIST]: string
}>

export const defineWorkshop = async ({
  cwd,
  background,
  color,
  designTokens,
  development = {
    hmr: true,
    console: true,
  },
  port = 3000,
}: DefineWorkshopParams) => {
  const disconnectSet = new Set<Disconnect>()
  const { bThreads, useFeedback, useSnapshot, trigger } = bProgram()

  const colorSignal = useSignal(color)
  const backgroundSignal = useSignal(background)
  const designTokensSignal = useSignal(designTokens)
  const testMapSignal = useSignal(new Map<string, TestParams[]>())

  const { url, reload } = await startServer({
    colorSignal,
    backgroundSignal,
    designTokensSignal,
    testMapSignal,
    port,
    cwd,
    development,
  })

  useFeedback<WorkshopHandlers>({
    async [PUBLIC_EVENTS.TEST_STORY_SET](filePath) {
      // await
    },
    async [PUBLIC_EVENTS.TEST_ALL_STORY_SETS]() {
      // await
    },
    async [EVENTS.RELOAD_SERVER]() {
      await reload()
    },
    [PUBLIC_EVENTS.SET_TEST_BACKGROUND_STYLE]() {},
    [PUBLIC_EVENTS.SET_TEST_PAGE_COLOR_STYLE]() {},
    [PUBLIC_EVENTS.SET_DESIGN_TOKENS]() {},
    [PUBLIC_EVENTS.GET_DESIGN_TOKEN_ENTRY]() {},
    [PUBLIC_EVENTS.GET_FILTERED_DESIGN_TOKEN_ENTRIES]() {},
    [PUBLIC_EVENTS.GET_ALL_DESIGN_TOKEN_ENTRIES]() {},
    [PUBLIC_EVENTS.CHECK_IF_DESIGN_TOKEN_EXIST]() {},
  })
  return {
    trigger: getPublicTrigger({ trigger, publicEvents: Object.values(PUBLIC_EVENTS) }),
  }
}
