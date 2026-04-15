import { relative, resolve } from 'node:path'
import { $ } from 'bun'

const RG_PATH = Bun.which('rg')

if (!RG_PATH) {
  throw new Error("Required tool 'rg' not found on PATH. Install ripgrep to use grep-worker.")
}

type GrepRequest = {
  pattern: string
  path?: string
  glob?: string
  ignoreCase?: boolean
  literal?: boolean
  context?: number
  limit?: number
}

type GrepMatch = {
  path: string
  line: number
  text: string
  context?: { before?: string[]; after?: string[] }
}

const parseGrepOutput = ({ stdout, cwd, limit }: { stdout: string; cwd: string; limit: number }) => {
  if (!stdout.trim()) return { matches: [], totalMatches: 0, truncated: false }

  const matches: GrepMatch[] = []
  let totalMatches = 0
  let pendingBefore: string[] = []
  let lastMatch: GrepMatch | undefined

  for (const entry of Bun.JSONL.parse(stdout)) {
    const record = entry as { type: string; data: Record<string, unknown> }
    if (record.type === 'context') {
      const lineText = ((record.data.lines as { text: string }).text ?? '').replace(/\n$/, '')
      const lineNumber = record.data.line_number as number

      if (lastMatch && lineNumber > lastMatch.line) {
        lastMatch.context ??= {}
        lastMatch.context.after ??= []
        lastMatch.context.after.push(lineText)
      } else {
        pendingBefore.push(lineText)
      }
      continue
    }

    if (record.type === 'match') {
      totalMatches++
      if (matches.length >= limit) continue

      const pathData = record.data.path as { text: string }
      const lineText = ((record.data.lines as { text: string }).text ?? '').replace(/\n$/, '')
      const match: GrepMatch = {
        path: relative(cwd, pathData.text),
        line: record.data.line_number as number,
        text: lineText,
      }

      if (pendingBefore.length > 0) {
        match.context = { before: pendingBefore }
        pendingBefore = []
      }

      matches.push(match)
      lastMatch = match
      continue
    }

    if (record.type === 'begin') {
      pendingBefore = []
      lastMatch = undefined
    }
  }

  return { matches, totalMatches, truncated: totalMatches > limit }
}

if (import.meta.main) {
  const request = JSON.parse(Bun.argv[2] ?? '{}') as GrepRequest
  const cwd = process.cwd()
  const searchPath = request.path ? resolve(cwd, request.path) : cwd
  const limit = request.limit ?? 100
  const rgArgs = ['--json']

  if (request.ignoreCase) rgArgs.push('--ignore-case')
  if (request.literal) rgArgs.push('--fixed-strings')
  if (request.glob) rgArgs.push('--glob', request.glob)
  if (request.context != null) rgArgs.push('--context', String(request.context))

  const result = await $`${RG_PATH} ${rgArgs} ${request.pattern} ${searchPath}`.quiet().nothrow()

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    if (result.stderr.length > 0) {
      process.stderr.write(result.stderr)
    }
    process.exit(result.exitCode)
  }

  process.stdout.write(
    JSON.stringify(
      parseGrepOutput({
        stdout: result.stdout.toString(),
        cwd,
        limit,
      }),
    ),
  )
}
