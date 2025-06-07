declare global {
  // eslint-disable-next-line no-var
  var reloadCount: number
}

import { Glob } from 'bun'
import { type BunPlugin } from 'bun'

import { STORY_GLOB_PATTERN, STORIES_FILTERS_REGEX } from '../testing/assert.constants'
import { TIMEOUT_ERROR } from './workshop.constants.js'

export async function globEntries(cwd: string): Promise<string[]> {
  const glob = new Glob(STORY_GLOB_PATTERN)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

export const cacheBustHeaders = {
  'cache-control': 'no-cache, must-revalidate',
  expires: 'Mon, 1 Jun 2025 06:30:30 GMT',
}

export const zip = async (artifact: Bun.BuildArtifact) => {
  const code = await artifact.text()
  const compressed = Bun.gzipSync(code)
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
  output,
  htmlEntries,
  responses,
}: {
  output: string
  htmlEntries: string[]
  responses: Map<string, Response>
}): Promise<void> => {
  const { outputs } = await Bun.build({
    entrypoints: htmlEntries,
    splitting: true,
    sourcemap: 'inline',
    root: output,
    plugins: [appendTextFixture],
    minify: true,
  })
  await Promise.all(
    outputs.map(async (output) => {
      const { path } = output
      const formattedPath =
        path.startsWith('.') ? path.replace('.', '')
        : !path.startsWith('/') ? `/${path}`
        : path
      responses.set(
        formattedPath,
        output.type.startsWith('text/javascript;') ? await zip(output) : new Response(output),
      )
    }),
  )
}

/**
 * Custom error for test timeout scenarios.
 * Thrown when a test exceeds its specified timeout duration.
 *
 * @extends Error
 * @property name Constant identifier 'TIMEOUT_ERROR'
 *
 */
export class TimeoutError extends Error {
  override name = TIMEOUT_ERROR
  constructor(message: string) {
    super(message)
  }
}
