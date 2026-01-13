import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { getServer } from '../workshop.ts'

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    port: { type: 'string' },
    cwd: { type: 'string' },
    'color-scheme': { type: 'string' },
  },
  strict: true,
  allowPositionals: true,
})

const port = values.port ? parseInt(values.port, 10) : 0

if (port && (Number.isNaN(port) || port < 0 || port > 65535)) {
  throw new Error(`ERROR: Invalid port number: ${values.port}. Must be between 0-65535`)
}

const cwd = values.cwd ? resolve(process.cwd(), values.cwd) : process.cwd()

const colorScheme = values?.['color-scheme'] === 'dark' ? 'dark' : 'light'

// Get paths from positionals (skip: bun, script path, "run" subcommand)
let paths = positionals.slice(3)

if (paths.length === 0) {
  paths = [process.cwd()]
}

await getServer({
  port,
  cwd,
  colorScheme,
  paths,
})
