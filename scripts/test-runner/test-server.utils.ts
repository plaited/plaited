import { Glob } from 'bun'
import { basename, dirname } from 'node:path'
import type { SignalWithInitialValue } from '../../src/behavioral.js'
import { kebabCase } from '../../src/utils.js'
import type { StoryObj } from '../../src/testing.js'
import { WORKSHOP_ROUTE } from './test-server.constants.js'
import type { StoryParams } from './test-server.types.js'

/**
 * @internal
 * Scans directory for files matching glob pattern.
 * @param cwd - Working directory
 * @param pattern - Glob pattern
 * @returns Absolute file paths
 */
export const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

const STORIES_FILTERS_REGEX = /\.stories.tsx?$/
/**
 * Creates kebab-case route for story URLs.
 *
 * @param options - Route configuration
 * @param options.filePath - Story file path
 * @param options.exportName - Exported story name
 * @returns Route like "/components/button--primary"
 *
 * @example
 * ```ts
 * createStoryRoute({
 *   filePath: "/src/Button.stories.tsx",
 *   exportName: "Primary"
 * }); // "/src/button--primary"
 * ```
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
  return new Response(compressed as BodyInit, {
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
      if (kind === 'entry-point' && path === `.${WORKSHOP_ROUTE}`) {
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
