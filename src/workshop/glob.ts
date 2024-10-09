import {
  STORY_GLOB_PATTERN,
  TEMPLATE_FILTER_REGEX,
  TEMPLATE_GLOB_PATTERN,
  WORKER_FILTER_REGEX,
  WORKER_GLOB_PATTERN,
} from './workshop.constants.ts'

export const globStories = async (cwd: string) => {
  const glob = new Bun.Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

export const globTemplates = async (cwd: string) => {
  const glob = new Bun.Glob(TEMPLATE_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.flatMap((path) => (TEMPLATE_FILTER_REGEX.test(path) ? Bun.resolveSync(`./${path}`, cwd) : []))
}

export const globWorkers = async (cwd: string) => {
  const glob = new Bun.Glob(WORKER_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.flatMap((path) => (WORKER_FILTER_REGEX.test(path) ? Bun.resolveSync(`./${path}`, cwd) : []))
}
