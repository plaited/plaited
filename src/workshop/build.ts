import * as esbuild from 'esbuild'
import {
  STORY_FILTER_REGEX,
  STORY_NAMESPACE,
  TEMPLATE_BUILD_FILTER_REGEX,
  SERVER_TEMPLATE_NAMESPACE,
} from './workshop.constants.js'
import { scanTemplateImports } from './scan.js'

export const build = async ({
  absWorkingDir,
  entries = [],
  virtualEntries = new Map(),
}: {
  absWorkingDir: string
  entries?: string[]
  virtualEntries?: Map<string, string>
}) => {
  const entryPoints = process.env.NODE_ENV === 'production'
    ? entries:[
      Bun.resolveSync('./use-play.tsx', import.meta.dir),
      ...virtualEntries.keys(),
      ...entries
    ]
  return await esbuild.build({
    bundle: true,
    absWorkingDir,
    entryPoints: entryPoints,
    format: 'esm',
    metafile: true,
    minify: process.env.NODE_ENV === 'production',
    outdir: '.',
    write: false,
    sourcemap: process.env.NODE_ENV === 'production' ? undefined : 'inline',
    splitting: true,
    target: 'browser',
    plugins: [
      {
        name: 'workshop-plugin',
        setup({ onResolve, onLoad }) {
          onResolve({
            filter: TEMPLATE_BUILD_FILTER_REGEX,
            namespace: 'entry-point'
          }, (args) => {
            return { path: args.path, namespace: SERVER_TEMPLATE_NAMESPACE }
          })
          onLoad({
            filter: /\.*/, namespace: SERVER_TEMPLATE_NAMESPACE
          }, async ({path}) => {
            const contents = await scanTemplateImports(path)
            return { contents, loader: 'tsx' }
          })
          onResolve({
            filter: STORY_FILTER_REGEX,
            namespace: 'entry-point'
          }, (args) => {
            return { path: args.path, namespace: STORY_NAMESPACE }
          })
          onLoad({
            filter: /\.*/, namespace: STORY_NAMESPACE
          }, ({path}) => {
            const contents = virtualEntries.get(path)
            if (!contents) {
              throw new Error(`Could not find virtual module ${path}`)
            }
            return { contents, loader: 'tsx' }
          })
        },
      },
    ],
  })
}
