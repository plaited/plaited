import { Glob } from 'bun'
import { type BunPlugin } from 'bun'

import { STORY_GLOB_PATTERN, STORIES_FILTERS_REGEX } from '../testing/assert.constants'

export async function globEntries(cwd: string): Promise<string[]> {
  const glob = new Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

export const LIVE_RELOAD_PATHNAME = `/reload`

export const cacheBustHeaders = {
  'cache-control': 'no-cache, must-revalidate',
  expires: 'Mon, 1 Jun 2025 06:30:30 GMT',
}

export const zip = (content: string) => {
  const compressed = Bun.gzipSync(content)
  return new Response(compressed, {
    headers: {
      ...cacheBustHeaders,
      'content-type': 'text/javascript;charset=utf-8',
      'content-encoding': 'gzip',
    },
  })
}

const appendTextFixture: BunPlugin = {
  name: 'plaited-testing-import',
  setup(runtime) {
    runtime.onLoad(
      {
        filter: STORIES_FILTERS_REGEX,
      },
      async (props) => {
        const file = await Bun.file(props.path).text()
        return {
          contents: `import 'plaited/testing';\n${file}`,
        }
      },
    )
  },
}

export const buildEntries = async ({
  cwd,
  entrypoints,
  responses,
}: {
  cwd: string
  entrypoints: string[]
  responses: Map<string, Response>
}): Promise<void> => {
  const { outputs } = await Bun.build({
    entrypoints,
    splitting: true,
    sourcemap: 'inline',
    root: cwd,
    plugins: [appendTextFixture],
  })
  await Promise.all(
    outputs.map(async (output) => {
      const { path } = output
      const formattedPath =
        path.startsWith('.') ? path.replace('.', '')
        : !path.startsWith('/') ? `/${path}`
        : path
      const code = await output.text()
      responses.set(formattedPath, zip(code))
    }),
  )
}
