import { Glob } from 'bun'
import { basename, dirname } from 'node:path'
import { WORKSHOP_ROUTE } from './story-server.constants.js'
import { kebabCase } from '../utils.js'
import type { SignalWithInitialValue } from '../behavioral.js'
import type { StoryParams } from './story-server.types.js'
import type { StoryObj } from './story-fixture.types.js'

/**
 * @internal Scans for files matching a glob pattern within a specified directory.
 * Uses Bun's Glob API for efficient file searching.
 * @param cwd - The current working directory to scan from.
 * @param pattern - The glob pattern to match files against.
 * @returns A Promise that resolves to an array of absolute file paths matching the pattern.
 */
export const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

const STORIES_FILTERS_REGEX = /\.stories.tsx?$/
/**
 * Creates a standardized route path for story files in the workshop system.
 * Converts file paths and export names to kebab-case for consistent URL structure.
 *
 * @param options - Configuration object
 * @param options.relativePath - The relative file path of the story
 * @param options.exportName - The exported story name
 * @returns A formatted route path string in the format "{directory}/{basename}--{storyName}"
 *
 * @example
 * ```ts
 * // For a file "/src/components/Button.stories.tsx" with export "PrimaryButton"
 * createStoryRoute({
 *   filePath: "/src/components/Button.stories.tsx",
 *   exportName: "PrimaryButton"
 * });
 * // Returns: "/src/components/button--primary-button"
 * ```
 * @internal
 */
export const createStoryRoute = ({ filePath, exportName }: { filePath: string; exportName: string }) => {
  const dir = dirname(filePath)
  const base = kebabCase(basename(filePath.replace(STORIES_FILTERS_REGEX, '')))
  const storyName = kebabCase(exportName)
  const id = `${base}--${storyName}`
  return `${dir}/${id}`
}

export const addStoryParams = ({
  filePath,
  storySet,
  storyParamSet,
}: {
  filePath: string
  storySet: {
    [key: string]: StoryObj
  }
  storyParamSet: SignalWithInitialValue<Set<StoryParams>>
}) => {
  for (const exportName in storySet) {
    const route = createStoryRoute({ filePath, exportName })
    storyParamSet.get().add({
      route,
      exportName,
      filePath,
      recordVideo: storySet[exportName]?.parameters?.recordVideo,
    })
  }
}

export const zip = ({ content, contentType, headers }: { content: string; contentType: string; headers?: Headers }) => {
  const compressed = Bun.gzipSync(content)
  const defaultHeaders: Record<string, string> = {
    'content-type': contentType,
    'content-encoding': 'gzip',
  }
  if (headers) {
    for (const key in defaultHeaders) {
      headers.append(key, defaultHeaders[key])
    }
  }
  return new Response(compressed, {
    headers: headers ?? defaultHeaders,
  })
}

export const getEntryRoutes = async (cwd: string, entrypoints: string[]) => {
  const responses: {
    [key: string]: Response
  } = {}
  const { outputs } = await Bun.build({
    entrypoints: ['plaited/testing', ...entrypoints],
    splitting: true,
    root: cwd,
    // minify: true,
    sourcemap: 'inline',
  })
  await Promise.all(
    outputs.map(async (artifact) => {
      const path = artifact.path
      const content = await artifact.text()
      const { kind } = artifact
      let formattedPath: string = path
      if (kind === 'entry-point' && path === './workshop.js') {
        formattedPath = WORKSHOP_ROUTE
      } else if (kind === 'entry-point') {
        const base = basename(path, '.stories.js')
        const dir = dirname(path)
        formattedPath = `/${dir}/${kebabCase(base)}--index.js`
      } else if (path.startsWith('.')) {
        formattedPath = path.replace(/^\./, '')
      }
      Object.assign(responses, {
        [formattedPath]: zip({
          content,
          contentType: artifact.type,
        }),
      })
    }),
  )
  return responses
}
