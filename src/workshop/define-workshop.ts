import { defineBProgram, type DefineBProgramProps } from '../behavioral/define-b-program.js'
import type { BPEvent } from '../behavioral/b-thread.js'
import { type Disconnect, type Handlers, bProgram } from '../behavioral/b-program.js'
import { $ } from 'bun'
import { mkdtemp } from 'node:fs/promises'
import { sep } from 'node:path'
import { Glob } from 'bun'
import type { StoryObj } from './testing/plaited-fixture.types.js'
import type { TestRoutes, DefineWorkshopParams } from './workshop.types.js'
import { DEFAULT_PLAY_TIMEOUT } from './workshop.constants.js'
import { OUTPUT_DIR } from '../../.plaited.js'
import { keyMirror } from '../utils/key-mirror.js'

export const getStoriesFromfile = async (file: string) => {
  const { default: _, ...rest } = (await import(file)) as {
    [key: string]: StoryObj
  }
  return rest
}
/** Glob pattern used to find story files within the project. */
const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

export async function globStoryFiles(cwd: string): Promise<string[]> {
  const glob = new Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

const EVENTS = keyMirror(
  'TEST_FILES',
  'TEST_ALL_FILES',
  'GET_FILE_ROUTES',
  'SET_CURRENT_WORKING_DIRECTORY',
  'SET_BACKGROUND_STYLE',
  'SET_COLOR_STYLE',
  'SET_DESIGN_TOKENS',
  'START_SEVER',
)

export const defineWorkshop = async <A extends Handlers>({
  publicEvents,
  routes,
  cwd,
  background,
  color,
  designTokens,
  port = 3000,
}: DefineWorkshopParams) => {
  const { bThreads, useFeedback, useSnapshot } = bProgram()
  //Clean up tmp directory
  await $`rm -rf ${OUTPUT_DIR} && mkdir ${OUTPUT_DIR}`
  // Create randomly named output directory in temp directory
  const output = await mkdtemp(`${OUTPUT_DIR}${sep}`)
  // Glob story files ??? I honestly
  const entrypoints = await globStoryFiles(cwd)

  const defaultHandler: Handlers<{
    [typeof EVENTS.START_SEVER]: {}
  }> = {
    [START_SEVER]() {},
  }
}
