import { ssr } from 'plaited'
import { Page } from './page.js'
import { HydratingElement } from './hydrating-element.js'
import { getLibrary } from 'plaited/workshop'

const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}
const { libraryImportMap, libraryArtifacts } = await getLibrary()
const { outputs } = await Bun.build({
  entrypoints: [`${import.meta.dir}/page.tsx`, `${import.meta.dir}/hydrating-element.tsx`],
  splitting: true,
  root: import.meta.dir,
  external: ['plaited'],
  sourcemap: 'inline',
})
const responses: Map<string, Response> = new Map()
const artifacts = [...libraryArtifacts, ...outputs]
/** Loop through artifacts to map response paths */
for (const res of artifacts) {
  const path = res.path
  const content = await res.text()
  const formattedPath =
    path.startsWith('.') ? path.replace('.', '')
    : !path.startsWith('/') ? `/${path}`
    : path

  responses.set(formattedPath, zip(content))
}
/** Add out fixture to the response map */
responses.set(
  '/',
  new Response(
    ssr(
      <Page libraryImportMap={libraryImportMap}>
        <HydratingElement />
      </Page>,
    ),
  ),
)
/** Create a bun server to server fixture and bundles */

export const start = () => {
  const server = Bun.serve({
    port: 3001,
    routes: Object.fromEntries(responses),
  })

  process.on('SIGINT', async () => {
    server.stop()
  })

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  })

  process.on('exit', () => {
    server.stop()
  })

  process.on('SIGTERM', () => {
    server.stop()
  })

  process.on('SIGHUP', () => {
    server.stop()
  })  
  return server
}
