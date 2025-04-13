import { STORY_GLOB_PATTERN } from 'plaited/testing'

export const globStories = async (cwd: string) => {
  const glob = new Bun.Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}
