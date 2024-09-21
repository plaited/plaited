import {
  STORY_GLOB_PATTERN,
  TEMPLATE_FILTER_REGEX,
  TEMPLATE_GLOB_PATTERN,
  WORKER_FILTER_REGEX,
  WORKER_GLOB_PATTERN,
} from './workshop.constants.js'

export const globStories = async (cwd: string) => {
  const glob = new Bun.Glob(STORY_GLOB_PATTERN)
  return await Array.fromAsync(glob.scan({ cwd }))
}

export const globTemplates = async (cwd: string) => {
  const glob = new Bun.Glob(TEMPLATE_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.filter(TEMPLATE_FILTER_REGEX.test.bind(TEMPLATE_FILTER_REGEX))
}

export const globWorkers = async (cwd: string) => {
  const glob = new Bun.Glob(WORKER_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.filter(WORKER_FILTER_REGEX.test.bind(WORKER_FILTER_REGEX))
}