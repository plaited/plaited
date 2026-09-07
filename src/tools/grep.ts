import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { useTool } from './use-tool.ts'

type GrepOutput = {
  matches: Array<{ path: string; line: number; text: string }>
  truncated: boolean
}

const MAX_MATCHES = 200

/**
 * Search for a pattern in files using `rg` (ripgrep) when available, with
 * a JS line-scanner fallback.
 *
 * MINIMAL: no `include` glob support in fallback path, fallback bounded to
 * 100 files / 1000 lines per file. Upgrade path: walk + glob filter in
 * fallback.
 */

export const GREP_TOOL_NAME = 'grep'

const runWithRg = async ({
  pattern,
  searchPath,
  include,
  rgPath,
}: {
  pattern: string
  searchPath: string
  include: string | undefined
  rgPath: string
}): Promise<GrepOutput> => {
  const args = ['-n', '--no-heading', '--color', 'never']
  if (include) {
    args.push('-g', include)
  }
  args.push(pattern)
  args.push(searchPath)

  try {
    const proc = Bun.spawn([rgPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const [stdout, _stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])

    const matches: GrepOutput['matches'] = []
    for (const line of stdout.split('\n')) {
      if (!line) continue
      // rg -n --no-heading output: "path:line:content"
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const rest = line.slice(colonIdx + 1)
      const secondColon = rest.indexOf(':')
      if (secondColon === -1) continue
      const filePath = line.slice(0, colonIdx)
      const lineNum = Number.parseInt(rest.slice(0, secondColon), 10)
      const text = rest.slice(secondColon + 1)

      matches.push({ path: filePath, line: lineNum, text })

      if (matches.length >= MAX_MATCHES) break
    }

    return { matches, truncated: matches.length >= MAX_MATCHES }
  } catch {
    return { matches: [], truncated: false }
  }
}

const runFallback = async ({
  pattern,
  searchPath,
  include,
}: {
  pattern: string
  searchPath: string
  include: string | undefined
}): Promise<GrepOutput> => {
  const dir = searchPath

  // rg's -g matches files recursively throughout the tree. Bun.Glob
  // without **/ only matches at the root, so we prepend **/ when the
  // include glob isn't already recursive.
  //
  // MINIMAL: no exclude/invert-glob support. Upgrade path: parse
  // comma-separated globs, support -g !exclude.
  const rawGlob = include ?? '**/*'
  const globPattern = rawGlob.startsWith('**/') || rawGlob.startsWith('/') ? rawGlob : `**/${rawGlob}`

  const matches: GrepOutput['matches'] = []
  let fileCount = 0

  try {
    const glob = new Bun.Glob(globPattern)
    for await (const file of glob.scan({ cwd: dir })) {
      if (++fileCount > 100) break // MINIMAL: bounded
      const absPath = path.isAbsolute(file) ? file : path.join(dir, file)
      const bunFile = Bun.file(absPath)
      const exists = await bunFile.exists()
      if (!exists) continue

      let text: string
      try {
        text = await bunFile.text()
      } catch {
        continue
      }

      const lines = text.split('\n')
      for (let i = 0; i < Math.min(lines.length, 1000); i++) {
        if (lines[i]!.includes(pattern)) {
          matches.push({ path: file, line: i + 1, text: lines[i]! })
          if (matches.length >= MAX_MATCHES) break
        }
      }
      if (matches.length >= MAX_MATCHES) break
    }
  } catch {
    // Swallow errors in fallback
  }

  return { matches, truncated: matches.length >= MAX_MATCHES }
}

type Input = {
  pattern: string
  cwd: string
  dir?: string
  include?: string
}

export const GrepInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    pattern: { type: 'string', minLength: 1, description: 'pattern to search for' },
    cwd: { type: 'string', description: "the tool's provisioned cwd" },
    dir: {
      type: 'string',
      nullable: true,
      description: "directory to search (defaults to the tool's provisioned cwd)",
    },
    include: { type: 'string', nullable: true, description: 'glob filter for file names (e.g. "*.ts")' },
  },
  required: ['pattern', 'cwd'],
  additionalProperties: false,
}

type Output = {
  matches: Array<{ path: string; line: number; text: string }>
  truncated: boolean
  message?: string
  isError?: boolean
}

export const GrepOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          line: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['path', 'line', 'text'],
        additionalProperties: false,
      },
    },
    truncated: { type: 'boolean' },
    message: { type: 'string', nullable: true, description: 'error detail when isError — states what failed' },
    isError: { type: 'boolean', nullable: true, description: 'true when the operation failed' },
  },
  required: ['matches', 'truncated'],
  additionalProperties: false,
}

/**
 * Search for a pattern in files using ripgrep (rg) when available, with a JS
 * line-scanner fallback. Returns matching lines with file path, line number,
 * and text.
 *
 * `cwd` is a required input field — provided by the provisioner. Returns an
 * info message when no matches are found, and an error result on failure.
 */
export const grep = useTool(
  {
    name: GREP_TOOL_NAME,
    description: 'Search for a pattern in files. Prefers ripgrep (rg) when available; falls back to a JS line scanner.',
    inputSchema: GrepInputSchema,
    outputSchema: GrepOutputSchema,
  },
  async ({ pattern, dir, include, cwd }, validate) => {
    try {
      const resolvedSearch = path.resolve(cwd, dir ?? '.')
      const rgPath = Bun.which('rg')

      let output: Output
      if (rgPath) {
        output = await runWithRg({ pattern, searchPath: resolvedSearch, include, rgPath })
      } else {
        output = await runFallback({ pattern, searchPath: resolvedSearch, include })
      }

      if (output.matches.length === 0) {
        output.message = `[Info: no matches found for pattern "${pattern}" in ${resolvedSearch}]`
      }

      return output
    } catch (err) {
      return {
        matches: [],
        truncated: false,
        message: `[Error: failed to search: ${(err as Error).message}]`,
        isError: true,
      }
    }
  },
)
