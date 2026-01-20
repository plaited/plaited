#!/usr/bin/env bun
/**
 * Scaffold a new ACP adapter project.
 *
 * @usage
 * bun scaffold.ts <name> [--output <dir>] [--lang ts|python] [--minimal]
 *
 * @output JSON
 * { "outputDir": string, "files": string[], "lang": "ts" | "python" }
 */

import { stat } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { runScaffold } from '../../../../src/adapter-scaffold.ts'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o' },
    lang: { type: 'string', default: 'ts' },
    minimal: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help) {
  console.error(`
Usage: bun scaffold.ts <name> [options]

Arguments:
  name              Adapter name (used for package name)

Options:
  -o, --output      Output directory (default: ./<name>-acp)
  --lang            Language: ts or python (default: ts)
  --minimal         Generate minimal boilerplate only
  -h, --help        Show this help message

Output:
  JSON object with outputDir, files, and lang
`)
  process.exit(0)
}

const name = positionals[0]
if (!name) {
  console.error('Error: adapter name is required')
  process.exit(1)
}

const lang = values.lang === 'python' ? 'python' : 'ts'
const outputDir = values.output ?? `./${name}-acp`

// Check if directory exists
const dirExists = await stat(outputDir).catch(() => null)
if (dirExists) {
  console.error(`Error: directory already exists: ${outputDir}`)
  process.exit(1)
}

const result = await runScaffold({
  name,
  outputDir,
  lang,
  minimal: values.minimal ?? false,
})

// Output JSON result
console.log(JSON.stringify(result))
