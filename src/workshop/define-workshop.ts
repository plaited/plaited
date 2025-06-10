// import { defineBProgram, type DefineBProgramProps } from '../behavioral/define-b-program.js'
// import type { BPEvent } from '../behavioral/b-thread.js'
// import type { Disconnect, Handlers } from '../behavioral/b-program.js'

import { Glob } from 'bun'
import type { StoryObj } from './testing/plaited-fixture.types.js'

const getStoriesFromfile = async (file: string) => {
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
// export const defineWorkshop = <A extends Handlers>({
//   bProgram,
//   publicEvents,
// }: {
//   bProgram: (args: DefineBProgramProps) => A
//   publicEvents: string[]
// }) => {}
