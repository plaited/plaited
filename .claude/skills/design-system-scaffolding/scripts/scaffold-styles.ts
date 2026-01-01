#!/usr/bin/env bun

/**
 * Generate a styles file with createStyles and createHostStyles.
 *
 * Usage: bun scaffold-styles.ts <name> [--host] [--output <path>]
 *
 * @example
 * bun scaffold-styles.ts button
 * bun scaffold-styles.ts toggle-input --host --output src/components/
 */

import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: {
      type: 'string',
      short: 'o',
      default: '.',
    },
    host: {
      type: 'boolean',
      default: false,
    },
  },
  allowPositionals: true,
})

const [name] = positionals

if (!name) {
  console.error('Usage: bun scaffold-styles.ts <name> [--host] [--output <path>]')
  console.error('  name: Style file name (e.g., button, card)')
  console.error('  --host: Include hostStyles for bElement')
  console.error('  --output, -o: Output directory (default: .)')
  console.error('')
  console.error('Examples:')
  console.error('  bun scaffold-styles.ts button')
  console.error('  bun scaffold-styles.ts toggle-input --host --output src/components/')
  process.exit(1)
}

const outputDir = resolve(process.cwd(), values.output ?? '.')
const fileName = `${name}.css.ts`
const filePath = join(outputDir, fileName)

const includeHost = values.host

const content = includeHost
  ? `import { createStyles, createHostStyles, joinStyles } from 'plaited'
// import { tokens } from './${name}.tokens.ts'

export const styles = createStyles({
  element: {
    padding: '8px',
    backgroundColor: {
      $default: 'white',
      ':hover': 'lightgray',
    },
  },
})

export const hostStyles = joinStyles(
  // tokens,  // Uncomment to include token CSS variables
  createHostStyles({
    display: 'inline-block',
  })
)
`
  : `import { createStyles } from 'plaited'

export const ${name}Styles = createStyles({
  ${name}: {
    padding: '8px 16px',
    backgroundColor: {
      $default: 'white',
      ':hover': 'lightgray',
    },
    borderRadius: '4px',
  },
})
`

console.log(
  JSON.stringify(
    {
      filePath,
      content,
      message: `Style file scaffold generated: ${fileName}`,
    },
    null,
    2,
  ),
)
