#!/usr/bin/env bun
/**
 * Validate ACP adapter compliance.
 *
 * @usage
 * bun check.ts <command> [args...] [--timeout <ms>] [--verbose]
 *
 * @output JSON
 * { "passed": boolean, "checks": CheckResult[], "summary": { total, passed, failed } }
 */

import { parseArgs } from 'node:util'
import { runCheck } from '../../../../src/adapter-check.ts'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    timeout: { type: 'string', default: '5000' },
    verbose: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help) {
  console.error(`
Usage: bun check.ts <command> [args...] [options]

Arguments:
  command [args]    Command to spawn the adapter

Options:
  --timeout         Timeout for each check in ms (default: 5000)
  --verbose         Include detailed protocol messages in output
  -h, --help        Show this help message

Output:
  JSON object with passed, checks array, and summary
`)
  process.exit(0)
}

if (positionals.length === 0) {
  console.error('Error: adapter command is required')
  process.exit(1)
}

const result = await runCheck({
  command: positionals,
  timeout: Number.parseInt(values.timeout ?? '5000', 10),
  verbose: values.verbose ?? false,
})

// Output JSON result
console.log(JSON.stringify(result))

// Exit with error code if checks failed
if (!result.passed) {
  process.exit(1)
}
