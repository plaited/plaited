import { Glob } from 'bun'

/** Glob pattern used to find story files within the project. */
export const STORY_GLOB_PATTERN = `**/*.stories.{tsx,ts}`

export async function globStoryFiles(cwd: string): Promise<string[]> {
  const glob = new Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}
