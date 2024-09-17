import type { BuildOutput } from 'bun'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { useSSR } from './use-ssr.js'
import { kebabCase, hashString } from '../utils.js'
import { STORIES_GLOB_PATTERN, USE_PLAY_ROUTE, WORKSHOP_ROUTE_ROOT } from './workshop.constants.js'
import { StoryObj, Parameters } from './workshop.types.js'
import { Page } from './Page.js'
import { jsMimeTypes } from './create-zipped-response.js'

const usePlayRegex = /\/use-play\.js$/
const jsRegex = /\.js$/
const rootRegex = /^\.\//

const globAndSortStories = async (root: string) => {
  const glob = new Bun.Glob(STORIES_GLOB_PATTERN)
  const routes = new Map<string, { filePath: string; exportName: string; id: string }>()
  const paths = await Array.fromAsync(glob.scan({ cwd: root }))
  const entries: Set<string> = new Set()
  const regex = RegExp(`^${root}`)
  const tmp = await fs.mkdtemp(path.join(tmpdir(), 'storybook-'))
  await Promise.all(
    paths.map(async (storySrc) => {
      try {
        const { default: _, ...modules } = await import(storySrc)
        const filePath = storySrc.replace(regex, '')
        for (const exportName of modules) {
          const dirname = path.dirname(filePath)
          const ext = path.extname(filePath)
          const suffix = `.stories${ext}`
          const basename = filePath.endsWith(suffix) ? kebabCase(path.basename(filePath, suffix)) : ''
          const storyName = kebabCase(exportName)
          const route = [WORKSHOP_ROUTE_ROOT, dirname, basename, storyName].filter(Boolean).join('/')
          if (routes.has(route)) {
            const { filePath: prevPath, exportName: prevName } = routes.get(route)!
            console.log(
              `\nDuplicate route: ${route}` +
                `\n  path: ${prevPath}` +
                `\n  exportName: ${prevName}` +
                `\n  Rename: ${exportName} in ${storySrc}`,
            )
            return
          }
          const id = hashString(route)?.toString(36) ?? [basename, storyName].filter(Boolean).join('--')
          routes.set(route, { filePath: storySrc, exportName, id })
          const entryPath = path.join(tmp, `${route}.js`)
          await Bun.write(entryPath, `export {${exportName}} from '${filePath}'`)
          entries.add(entryPath)
        }
      } catch (err) {
        console.error(err)
      }
    }),
  )
  return { entries, routes, tmp }
}

const buildStories = async (root: string, entrypoints: string[]) =>
  await Bun.build({
    entrypoints: [Bun.resolveSync('./use-play.tsx', import.meta.dir), ...entrypoints],
    format: 'esm',
    minify: process.env.NODE_ENV === 'production',
    root,
    sourcemap: process.env.NODE_ENV === 'production' ? 'none' : 'inline',
    splitting: true,
    target: 'browser',
  })

const mapStories = async ({
  outputs,
  routes,
  responseMap,
  storyMap,
}: {
  outputs: BuildOutput['outputs']
  routes: Map<string, { filePath: string; exportName: string; id: string }>
  responseMap: Map<string, Response>
  storyMap: Set<{ id: string; pathname: string; parameters?: Parameters; searchParams?: string }>
}) => {
  await Promise.all(
    outputs.map(async (blob) => {
      const { path, kind } = blob
      const isUsePlay = usePlayRegex.test(path)
      responseMap.set(
        isUsePlay ? USE_PLAY_ROUTE : path.replace(rootRegex, '/'),
        new Response(blob, { headers: { 'Content-Type': jsMimeTypes[0] } }),
      )
      if (isUsePlay || kind !== 'entry-point') return
      const key = path.replace(jsRegex, '')
      const route = routes.get(key)
      if (route) {
        const { filePath, exportName, id } = route
        let story: StoryObj
        try {
          ;({ [exportName]: story } = (await import(filePath)) as { [key: string]: StoryObj })
        } catch (err) {
          return console.error(err)
        }
        const { render: Render, attrs, parameters } = story
        const ssr = useSSR(USE_PLAY_ROUTE, path)
        const page = ssr(<Page storyId={id}>{Render && <Render {...(attrs ?? {})} />}</Page>)
        responseMap.set(key, new Response(`<!DOCTYPE html>\n${page}`, { headers: { 'Content-Type': 'text/html' } }))
        storyMap.add({
          id,
          pathname: key,
          parameters,
        })
      }
    }),
  )
}

export const getStories = async (root: string) => {
  const storyMap = new Set<{
    id: string
    pathname: string
    parameters?: Parameters
    searchParams?: string
  }>()
  const responseMap = new Map<string, Response>()
  const { entries, routes, tmp } = await globAndSortStories(root)
  let logs: BuildOutput['logs'] = []
  let outputs: BuildOutput['outputs'] = []
  let success: BuildOutput['success'] = false
  try {
    ;({ outputs, success, logs } = await buildStories(tmp, [...entries]))
  } catch {
    console.error(logs)
  }
  success && (await mapStories({ outputs, routes, responseMap, storyMap }))
  await fs.rm(tmp, { recursive: true })
  return { storyMap, responseMap }
}
