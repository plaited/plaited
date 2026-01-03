#!/usr/bin/env bun

/**
 * Generate a story file for testing templates.
 *
 * Usage: bun scaffold-story.ts <name> [--element <tag>] [--output <path>]
 *
 * @example
 * bun scaffold-story.ts button
 * bun scaffold-story.ts toggle-input --element toggle-input --output src/components/
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
    element: {
      type: 'string',
      short: 'e',
    },
  },
  allowPositionals: true,
})

const [name] = positionals

if (!name) {
  console.error('Usage: bun scaffold-story.ts <name> [--element <tag>] [--output <path>]')
  console.error('  name: Story file name')
  console.error('  --element, -e: Custom element tag to import (for bElement stories)')
  console.error('  --output, -o: Output directory (default: .)')
  console.error('')
  console.error('Examples:')
  console.error('  bun scaffold-story.ts button')
  console.error('  bun scaffold-story.ts toggle-input --element toggle-input --output src/components/')
  process.exit(1)
}

const outputDir = resolve(process.cwd(), values.output ?? '.')
const fileName = `${name}.stories.tsx`
const filePath = join(outputDir, fileName)

// Convert kebab-case to PascalCase
const toPascalCase = (str: string) =>
  str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const pascalName = toPascalCase(name)
const elementTag = values.element

const content = elementTag
  ? `import { story } from 'plaited/testing'
import { ${pascalName} } from './${name}.ts'

export const basic${pascalName} = story({
  description: 'Basic ${name} element',
  render: () => <${pascalName} />,
  async play({ findByAttribute, assert }) {
    const element = await findByAttribute('p-target', 'root')
    assert({
      given: 'element renders',
      should: 'be in the document',
      actual: element !== null,
      expected: true,
    })
  },
})
`
  : `import { type FT } from 'plaited/ui'
import { story } from 'plaited/testing'
import { ${name}Styles } from './${name}.css.ts'

const ${pascalName}: FT = ({ children }) => (
  <div {...${name}Styles.${name}}>{children}</div>
)

export const basic${pascalName} = story({
  description: 'Basic ${name} template',
  render: () => <${pascalName}>Content</Button>,
})
`

console.log(
  JSON.stringify(
    {
      filePath,
      content,
      message: `Story file scaffold generated: ${fileName}`,
    },
    null,
    2,
  ),
)
