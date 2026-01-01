#!/usr/bin/env bun

/**
 * Generate a complete bElement with associated files.
 *
 * Usage: bun scaffold-behavioral-template.ts <name> [--form-associated] [--output <path>]
 *
 * @example
 * bun scaffold-behavioral-template.ts toggle-input --form-associated --output src/components/
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
    'form-associated': {
      type: 'boolean',
      default: false,
    },
  },
  allowPositionals: true,
})

const [name] = positionals

if (!name) {
  console.error('Usage: bun scaffold-behavioral-template.ts <name> [--form-associated] [--output <path>]')
  console.error('  name: Element name (kebab-case, e.g., toggle-input)')
  console.error('  --form-associated: Include formAssociated: true')
  console.error('  --output, -o: Output directory (default: .)')
  console.error('')
  console.error('Examples:')
  console.error('  bun scaffold-behavioral-template.ts toggle-input --form-associated --output src/components/')
  process.exit(1)
}

const outputDir = resolve(process.cwd(), values.output ?? '.')
const formAssociated = values['form-associated']

// Convert kebab-case to PascalCase
const toPascalCase = (str: string) =>
  str
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

const pascalName = toPascalCase(name)

// Generate tokens file
const tokensFile = {
  path: join(outputDir, `${name}.tokens.ts`),
  content: `import { createTokens } from 'plaited'

export const ${name.replace(/-/g, '')}Tokens = createTokens('${name}', {
  fill: {
    $default: { $value: 'lightblue' },
    $compoundSelectors: {
      ':state(checked)': { $value: 'blue' },
      ':state(disabled)': { $value: 'gray' },
    },
  },
})
`,
}

// Generate styles file
const stylesFile = {
  path: join(outputDir, `${name}.css.ts`),
  content: `import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { ${name.replace(/-/g, '')}Tokens } from './${name}.tokens.ts'

export const styles = createStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
})

export const hostStyles = joinStyles(
  ${name.replace(/-/g, '')}Tokens,
  createHostStyles({
    display: 'inline-block',
  })
)
`,
}

// Generate element file
const elementContent = formAssociated
  ? `import { bElement } from 'plaited'
import { styles, hostStyles } from './${name}.css.ts'

export const ${pascalName} = bElement({
  tag: '${name}',
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div p-target="root" {...styles.root} p-trigger={{ click: 'click' }}>
      <slot />
    </div>
  ),
  bProgram({ trigger, internals }) {
    return {
      click() {
        const checked = !internals.states.has('checked')
        if (checked) {
          internals.states.add('checked')
        } else {
          internals.states.delete('checked')
        }
        internals.setFormValue(checked ? 'on' : null)
        trigger({ type: 'change', detail: { checked } })
      },
    }
  },
})
`
  : `import { bElement } from 'plaited'
import { styles, hostStyles } from './${name}.css.ts'

export const ${pascalName} = bElement({
  tag: '${name}',
  hostStyles,
  shadowDom: (
    <div p-target="root" {...styles.root} p-trigger={{ click: 'click' }}>
      <slot />
    </div>
  ),
  bProgram({ trigger }) {
    return {
      click() {
        trigger({ type: 'clicked' })
      },
    }
  },
})
`

const elementFile = {
  path: join(outputDir, `${name}.ts`),
  content: elementContent,
}

// Generate story file
const storyFile = {
  path: join(outputDir, `${name}.stories.tsx`),
  content: `import { story } from 'plaited/testing'
import { ${pascalName} } from './${name}.ts'

export const basic${pascalName} = story({
  description: 'Basic ${name} element',
  render: () => <${pascalName}>Label</Button>,
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
`,
}

console.log(
  JSON.stringify(
    {
      files: [tokensFile, stylesFile, elementFile, storyFile],
      message: `bElement scaffold generated: ${name}`,
    },
    null,
    2,
  ),
)
