import * as path from 'node:path'
import * as z from 'zod'
import { useMCPServer } from './use-mcp-server.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    pattern: { type: 'string', minLength: 1, description: 'pattern to search for' },
    dir: { type: 'string', description: "directory to search (defaults to the tool's provisioned cwd)" },
    include: { type: 'string', description: 'glob filter for file names (e.g. "*.ts")' },
  },
  required: ['pattern', 'cwd'],
  additionalProperties: false,
}

export const outputSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, line: { type: 'integer' }, text: { type: 'string' } },
        required: ['path', 'line', 'text'],
      },
    },
    truncated: { type: 'boolean' },
  },
  required: ['matches', 'truncated'],
  additionalProperties: false,
}

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

/**
 * Search for a pattern in files using ripgrep (rg) when available, with a JS
 * line-scanner fallback. Returns matching lines with file path, line number,
 * and text.
 *
 * Registered via `useMCPServer` as the `grep` MCP tool. `cwd` is a required
 * input field — provided by the provisioner. Returns an info message when no
 * matches are found, and an error result on failure.
 */
export const grep = useMCPServer((server) => {
  server.registerTool(
    GREP_TOOL_NAME,
    {
      description:
        'Search for a pattern in files. Prefers ripgrep (rg) when available; falls back to a JS line scanner.',
      inputSchema: z.object({
        pattern: z.string().min(1).describe('pattern to search for'),
        cwd: z.string().describe("the tool's provisioned cwd"),
        dir: z.string().optional().describe("directory to search (defaults to the tool's provisioned cwd)"),
        include: z.string().optional().describe('glob filter for file names (e.g. "*.ts")'),
      }),
      outputSchema: z.object({
        matches: z.array(
          z.object({
            path: z.string(),
            line: z.number().int(),
            text: z.string(),
          }),
        ),
        truncated: z.boolean(),
        message: z.string().optional().describe('error detail when isError — states what failed'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ pattern, dir, include, cwd }) => {
      try {
        const resolvedSearch = path.resolve(cwd, dir ?? '.')
        const rgPath = Bun.which('rg')

        let output: GrepOutput & { message?: string; isError?: boolean }

        if (rgPath) {
          output = await runWithRg({ pattern, searchPath: resolvedSearch, include, rgPath })
        } else {
          output = await runFallback({ pattern, searchPath: resolvedSearch, include })
        }

        if (output.matches.length === 0) {
          output.message = `[Info: no matches found for pattern "${pattern}" in ${resolvedSearch}]`
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = {
          matches: [],
          truncated: false,
          message: `[Error: failed to search: ${(err as Error).message}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})
