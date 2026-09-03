import * as path from 'node:path'
import type { CwdProvision, JsonObject, ToolArgs } from './tool.types.ts'

export const inputSchema = {
  type: 'object',
  properties: {
    pattern: { type: 'string', minLength: 1, description: 'pattern to search for' },
    path: { type: 'string', description: "directory to search (defaults to the tool's provisioned cwd)" },
    include: { type: 'string', description: 'glob filter for file names (e.g. "*.ts")' },
  },
  required: ['pattern'],
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

type GrepInput = { pattern: string; path?: string; include?: string }
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
export const run = async (input: JsonObject & CwdProvision): Promise<{ output: GrepOutput }> => {
  // Args are Ajv-validated at dispatch and guard-blocked at selection.
  const { pattern, path: searchPath, include, cwd } = input as GrepInput & CwdProvision
  const resolvedSearch = path.resolve(cwd ?? process.cwd(), searchPath ?? '.')

  const rgPath = Bun.which('rg')

  if (rgPath) {
    return { output: await runWithRg(pattern, resolvedSearch, include, rgPath) }
  }

  return { output: await runFallback(pattern, resolvedSearch, include) }
}

const runWithRg = async (
  pattern: string,
  searchPath: string,
  include: string | undefined,
  rgPath: string,
): Promise<GrepOutput> => {
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

const runFallback = async (pattern: string, searchPath: string, include: string | undefined): Promise<GrepOutput> => {
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

const grepTool: ToolArgs = Object.freeze({
  name: 'grep',
  description: 'Search for a pattern in files. Prefers ripgrep (rg) when available; falls back to a JS line scanner.',
  inputSchema,
  outputSchema,
  run,
})

export default grepTool
