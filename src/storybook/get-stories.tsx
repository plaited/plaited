import fs from 'node:fs/promises'
import path from 'node:path'
import { rm } from 'fs/promises'
import { tmpdir } from 'node:os'
import { GLOB_PATTERN_STORIES } from './storybook.constants.js'
import { kebabCase, hashString } from '../utils.js'
import { Page } from './Page.js'
import { useSSR } from '../bun/use-ssr.js'
import { StoryObj, Parameters } from './storybook.types.js'
import { jsMimeTypes } from '../internal/create-zipped-response.js'
import type { BuildOutput } from 'bun'
const usePlayRegex = /\/use-play\.js$/
const jsRegex = /\.js$/

const globAndSortStories = async (root: string) => {
  const glob = new Bun.Glob(GLOB_PATTERN_STORIES)
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
          const route = ['_stories', dirname, basename, storyName].filter(Boolean).join('/')
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
          await Bun.write(entryPath, `import {${exportName}} from '${filePath}'`)
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
    sourcemap: 'inline',
    splitting: true,
    root,
  })

const mapStories = async ({
  root,
  outputs,
  routes,
  responseMap,
  storyMap,
}: {
  root: string
  outputs: BuildOutput['outputs']
  routes: Map<string, { filePath: string; exportName: string; id: string }>
  responseMap: Map<string, Response>
  storyMap: Set<{ id: string; pathname: string; parameters?: Parameters; searchParams?: string }>
}) => {
  const rootRegex = RegExp(`^${root}`)
  await Promise.all(
    outputs.map(async (blob) => {
      const { path, kind } = blob
      // Probably don't need this regex but may need something similar if path is like ../../*.js
      responseMap.set(path.replace(rootRegex, ''), new Response(blob, { headers: { 'Content-Type': jsMimeTypes[0] } }))
      if (usePlayRegex.test(path) || kind !== 'entry-point') return
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
        const { render: Render, attrs, parameters, location, searchParams } = story
        if (Render) {
          const ssr = useSSR(path)
          const page = ssr(
            <Page storyId={id}>
              <Render {...(attrs ?? {})} />
            </Page>,
          )
          responseMap.set(key, new Response(`<!DOCTYPE html>\n${page}`, { headers: { 'Content-Type': 'text/html' } }))
          storyMap.add({
            id,
            pathname: key,
            parameters,
          })
        }
        if (location) {
          storyMap.add({
            id,
            pathname: location,
            parameters,
            searchParams: searchParams?.toString(),
          })
        }
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
    ;({ outputs, success, logs } = await buildStories(root, [...entries]))
  } catch {
    console.error(logs)
  }
  success && (await mapStories({ root, outputs, routes, responseMap, storyMap }))
  await rm(tmp, { recursive: true })
  return { storyMap, responseMap }
}
