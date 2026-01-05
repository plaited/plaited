#!/usr/bin/env bun

/**
 * Scaffold a training story file with intent metadata.
 *
 * @remarks
 * Creates story files in the format expected by generate-trajectories.ts.
 * Each story export includes an `intent` field describing what the
 * template should accomplish in natural language.
 *
 * Usage:
 *   bun scripts/scaffold-training-story.ts <name> [options]
 *
 * Options:
 *   --output, -o    Output directory (default: current directory)
 *   --category, -c  Category prefix for story title (e.g., Button, Input)
 *   --intents, -i   Comma-separated list of intents to generate
 *   --help, -h      Show this help message
 *
 * Examples:
 *   bun scripts/scaffold-training-story.ts button --category Button --intents "primary,secondary,disabled"
 *   bun scripts/scaffold-training-story.ts card -c Card -i "simple,with header,with footer" -o src/templates
 */

import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    output: { type: 'string', short: 'o', default: '.' },
    category: { type: 'string', short: 'c' },
    intents: { type: 'string', short: 'i' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

if (values.help || positionals.length === 0) {
  console.log(`
Scaffold a training story file with intent metadata.

Usage:
  bun scripts/scaffold-training-story.ts <name> [options]

Options:
  --output, -o    Output directory (default: current directory)
  --category, -c  Category prefix for story title (e.g., Button, Input)
  --intents, -i   Comma-separated list of intents to generate
  --help, -h      Show this help message

Examples:
  bun scripts/scaffold-training-story.ts button --category Button --intents "primary,secondary,disabled"
  bun scripts/scaffold-training-story.ts card -c Card -i "simple,with header" -o src/templates

Intent Format:
  Intents are natural language descriptions of what the template should do.
  Good intents are:
  - Specific: "Create a primary button with hover state"
  - Action-oriented: "Build a form input with error message"
  - User-focused: "Add a disabled state to prevent interaction"

  Bad intents are:
  - Too vague: "Make a button"
  - Implementation-focused: "Use createStyles with blue background"
`)
  process.exit(values.help ? 0 : 1)
}

const name = positionals[0]
const category = values.category ?? name.charAt(0).toUpperCase() + name.slice(1)
const outputDir = values.output ?? '.'

/**
 * Convert intent description to PascalCase export name.
 */
const intentToExportName = (intent: string): string => {
  return intent
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Convert intent description to full sentence.
 */
const intentToDescription = (intent: string, category: string): string => {
  const base = intent.toLowerCase()
  if (base.includes('create') || base.includes('build') || base.includes('add')) {
    return intent
  }
  return `Create a ${base} ${category.toLowerCase()}`
}

/**
 * Generate story file content.
 */
const generateStoryContent = (name: string, category: string, intents: string[]): string => {
  const templateName = `${category}Template`
  const stories = intents
    .map((intent) => {
      const exportName = intentToExportName(intent)
      const description = intentToDescription(intent, category)

      return `
/**
 * ${description}.
 */
export const ${exportName} = story({
  template: () => (
    <${templateName}>
      {/* TODO: Implement ${intent} */}
    </${templateName}>
  ),
  intent: '${description}',
  play: async ({ assert }) => {
    await assert.a11y()
  },
})`
    })
    .join('\n')

  return `import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'

/**
 * Story exports for ${category} templates.
 *
 * @remarks
 * Each story includes an \`intent\` field for training data generation.
 * Run \`bun scripts/generate-trajectories.ts\` to create trajectories.
 */

export const meta = {
  title: '${category}',
}

/**
 * Base template for ${category}.
 *
 * @remarks
 * TODO: Replace with actual implementation.
 */
const ${templateName}: FT = ({ children }) => (
  <div data-template="${name}">
    {children}
  </div>
)
${stories}
`
}

const main = async () => {
  const intentsInput = values.intents ?? 'default'
  const intents = intentsInput.split(',').map((i) => i.trim())

  const content = generateStoryContent(name, category, intents)
  const filePath = join(outputDir, `${name}.stories.tsx`)

  await Bun.write(filePath, content)

  console.log(
    JSON.stringify(
      {
        created: filePath,
        category,
        intents: intents.length,
        stories: intents.map(intentToExportName),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
