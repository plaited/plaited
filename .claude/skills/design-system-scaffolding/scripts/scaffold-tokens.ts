#!/usr/bin/env bun

/**
 * Generate a tokens file with createTokens patterns.
 *
 * Usage: bun scaffold-tokens.ts <name> <namespace> [--output <path>]
 *
 * @example
 * bun scaffold-tokens.ts fills fills
 * bun scaffold-tokens.ts fills fills --output src/tokens/
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
  },
  allowPositionals: true,
})

const [name, namespace] = positionals

if (!name || !namespace) {
  console.error('Usage: bun scaffold-tokens.ts <name> <namespace> [--output <path>]')
  console.error('  name: Token file name (e.g., fills, spacing)')
  console.error('  namespace: Token namespace for CSS variables')
  console.error('  --output, -o: Output directory (default: .)')
  console.error('')
  console.error('Examples:')
  console.error('  bun scaffold-tokens.ts fills fills')
  console.error('  bun scaffold-tokens.ts fills fills --output src/tokens/')
  process.exit(1)
}

const outputDir = resolve(process.cwd(), values.output ?? '.')
const fileName = `${name}.tokens.ts`
const filePath = join(outputDir, fileName)

const content = `import { createTokens } from 'plaited'

export const ${name} = createTokens('${namespace}', {
  // Simple token
  primary: { $value: '#007bff' },

  // Token with state variations
  fill: {
    $default: { $value: 'lightblue' },
    $compoundSelectors: {
      ':state(checked)': { $value: 'blue' },
      ':state(disabled)': { $value: 'gray' },
      ':hover': { $value: 'skyblue' },
    },
  },
})
`

console.log(
  JSON.stringify(
    {
      filePath,
      content,
      message: `Token file scaffold generated: ${fileName}`,
    },
    null,
    2,
  ),
)
