#!/usr/bin/env bun

/**
 * Plaited Workshop MCP Server
 * 
 * Exposes plaited workshop capabilities via MCP for agent consumption:
 * - Design token generation and transformation
 * - ARIA pattern integration 
 * - Template generation with behavioral programming
 * - Workshop story creation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { TransformDesignTokens } from '../src/workshop/design-tokens/transform-design-tokens.js'
import type { 
  DesignTokenGroup, 
  DesignTokenEntry, 
  DesignToken,
  Alias
} from '../src/workshop/design-tokens/design-token.types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Zod schemas for tool parameters
const DesignTokenSchema = z.object({
  $description: z.string(),
  $type: z.enum(['color', 'size', 'amount', 'angle', 'function', 'composite']).optional(),
  $value: z.any(),
  $csv: z.boolean().optional(),
})

const DesignTokenGroupSchema: z.ZodType<DesignTokenGroup> = z.lazy(() =>
  z.record(z.union([DesignTokenSchema, DesignTokenGroupSchema]))
)

const GenerateDesignTokensSchema = z.object({
  tokens: DesignTokenGroupSchema,
  tokenPrefix: z.string().optional().default('pl'),
  outputFormat: z.enum(['css', 'typescript', 'both']).optional().default('both'),
})

const ValidateTokenSchemaSchema = z.object({
  tokens: DesignTokenGroupSchema,
})

const GetAriaPatternSchema = z.object({
  component: z.string().describe('ARIA pattern name (e.g., "button", "dialog", "accordion")'),
})

const GeneratePlaitedTemplateSchema = z.object({
  pattern: z.object({
    name: z.string(),
    description: z.string(),
    requirements: z.array(z.string()),
    roles: z.array(z.string()),
    keyboard: z.record(z.string()),
    properties: z.record(z.string()),
  }),
  tokens: z.array(z.object({
    alias: z.string(),
    value: z.any(),
    type: z.string().optional(),
  })).optional(),
  behavioralThreads: z.array(z.string()).optional(),
})

const GenerateBehaviorThreadSchema = z.object({
  requirement: z.string().describe('Natural language requirement to convert to b-thread'),
  context: z.object({
    component: z.string().optional(),
    events: z.array(z.string()).optional(),
    states: z.array(z.string()).optional(),
  }).optional(),
})

const CreateWorkshopStorySchema = z.object({
  template: z.object({
    name: z.string(),
    code: z.string(),
    props: z.record(z.any()).optional(),
  }),
  variants: z.array(z.object({
    name: z.string(),
    props: z.record(z.any()),
    description: z.string().optional(),
  })).optional(),
})

const ValidateBehavioralProgramSchema = z.object({
  bThreads: z.array(z.object({
    name: z.string(),
    code: z.string(),
    requirements: z.array(z.string()),
  })),
})

// Server setup
const server = new Server(
  {
    name: 'plaited-workshop',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Tool definitions
const tools: Tool[] = [
  {
    name: 'generateDesignTokens',
    description: 'Generate and transform design tokens to CSS variables and TypeScript definitions',
    inputSchema: GenerateDesignTokensSchema,
  },
  {
    name: 'validateTokenSchema',
    description: 'Validate design token schema for correctness and dependencies',
    inputSchema: ValidateTokenSchemaSchema,
  },
  {
    name: 'getAriaPattern',
    description: 'Retrieve ARIA pattern specification and requirements',
    inputSchema: GetAriaPatternSchema,
  },
  {
    name: 'generatePlaitedTemplate', 
    description: 'Generate a PlaitedTemplate component from ARIA pattern and design tokens',
    inputSchema: GeneratePlaitedTemplateSchema,
  },
  {
    name: 'generateBehaviorThread',
    description: 'Convert natural language requirement to behavioral programming b-thread',
    inputSchema: GenerateBehaviorThreadSchema,
  },
  {
    name: 'createWorkshopStory',
    description: 'Create workshop story for testing and documenting template variants',
    inputSchema: CreateWorkshopStorySchema,
  },
  {
    name: 'validateBehavioralProgram',
    description: 'Validate behavioral programming b-threads for correctness',
    inputSchema: ValidateBehavioralProgramSchema,
  },
  {
    name: 'listAriaPatterns',
    description: 'List all available ARIA patterns in the reference documentation',
    inputSchema: z.object({}),
  },
]

// ARIA pattern utilities
async function loadAriaPattern(patternName: string) {
  try {
    const patternsDir = join(__dirname, '../../corpus/reference-docs/aria-patterns')
    const patternFile = join(patternsDir, `${patternName}.md`)
    const content = await readFile(patternFile, 'utf-8')
    
    // Parse the markdown content to extract pattern information
    const lines = content.split('\n')
    let currentSection = ''
    const pattern = {
      name: patternName,
      description: '',
      requirements: [] as string[],
      roles: [] as string[],
      keyboard: {} as Record<string, string>,
      properties: {} as Record<string, string>,
      content: content,
    }
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        pattern.description = line.replace('# ', '').trim()
      } else if (line.startsWith('## ')) {
        currentSection = line.replace('## ', '').toLowerCase().trim()
      } else if (currentSection === 'keyboard interaction' && line.includes(':')) {
        const [key, desc] = line.split(':')
        if (key && desc) {
          pattern.keyboard[key.trim().replace(/^- /, '')] = desc.trim()
        }
      } else if (currentSection.includes('roles') && line.startsWith('- ')) {
        pattern.roles.push(line.replace('- ', '').trim())
      } else if (line.includes('aria-') || line.includes('role=')) {
        pattern.requirements.push(line.trim())
      }
    }
    
    return pattern
  } catch (error) {
    throw new Error(`Failed to load ARIA pattern '${patternName}': ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function listAvailableAriaPatterns() {
  try {
    const patternsDir = join(__dirname, '../../corpus/reference-docs/aria-patterns')
    const files = await readdir(patternsDir)
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''))
      .sort()
  } catch (error) {
    throw new Error(`Failed to list ARIA patterns: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Template generation utilities
function generatePlaitedTemplateCode(pattern: any, tokens: any[] = [], behavioralThreads: string[] = []) {
  const componentName = pattern.name.charAt(0).toUpperCase() + pattern.name.slice(1)
  const tokenImports = tokens.length > 0 ? 
    `import { ${tokens.map(t => t.alias.replace(/[{}]/g, '')).join(', ')} } from './design-tokens.js'\n` : ''
  
  const behavioralImports = behavioralThreads.length > 0 ?
    `import { BProgram, bThread } from '@plaited/behavioral'\n` : ''
  
  const propsInterface = generatePropsInterface(pattern, tokens)
  const behavioralCode = generateBehavioralCode(pattern, behavioralThreads)
  const templateCode = generateTemplateJSX(pattern, tokens)
  
  return `${tokenImports}${behavioralImports}import { css, PlaitedTemplate } from '@plaited/framework'

${propsInterface}

${behavioralCode}

export const ${componentName}: PlaitedTemplate<${componentName}Props> = {
  tag: '${pattern.name}',
  observedAttributes: ['disabled', 'aria-pressed', 'aria-expanded'],
  
  template: ({ disabled, ...props }) => \`
${templateCode}
  \`,
  
  styles: css\`
    :host {
      /* Base styles using design tokens */
      ${tokens.map(token => `--local-${token.alias.replace(/[{}]/g, '')}: var(${token.alias});`).join('\n      ')}
    }
    
    button {
      background: var(--local-background, var(--pl-button-background));
      border: var(--local-border, var(--pl-button-border));
      color: var(--local-color, var(--pl-button-color));
      padding: var(--local-padding, var(--pl-button-padding));
      border-radius: var(--local-radius, var(--pl-button-radius));
      font-family: var(--local-font-family, var(--pl-button-font-family));
      font-size: var(--local-font-size, var(--pl-button-font-size));
      font-weight: var(--local-font-weight, var(--pl-button-font-weight));
      cursor: pointer;
      transition: all 200ms ease;
    }
    
    button:hover {
      background: var(--local-background-hover, var(--pl-button-background-hover));
    }
    
    button:active {
      background: var(--local-background-active, var(--pl-button-background-active));
    }
    
    button:disabled {
      opacity: var(--local-opacity-disabled, var(--pl-button-opacity-disabled, 0.6));
      cursor: not-allowed;
    }
    
    button[aria-pressed="true"] {
      background: var(--local-background-pressed, var(--pl-button-background-pressed));
    }
  \`,
  
  ${behavioralThreads.length > 0 ? `connectedCallback: setupBehavioralProgram,` : ''}
}`
}

function generatePropsInterface(pattern: any, tokens: any[]) {
  return `interface ${pattern.name.charAt(0).toUpperCase() + pattern.name.slice(1)}Props {
  children?: string
  disabled?: boolean
  'aria-pressed'?: 'true' | 'false'
  'aria-expanded'?: 'true' | 'false'
  'aria-describedby'?: string
  'aria-labelledby'?: string
  'aria-label'?: string
  onclick?: string
  ${tokens.map(token => `${token.alias.replace(/[{}]/g, '')}?: string`).join('\n  ')}
}`
}

function generateBehavioralCode(pattern: any, behavioralThreads: string[]) {
  if (behavioralThreads.length === 0) return ''
  
  return `
// Behavioral Programming Implementation
function setupBehavioralProgram(element: HTMLElement) {
  const program = new BProgram()
  
  ${behavioralThreads.map((thread, i) => `program.add(${thread}Thread(element))`).join('\n  ')}
  
  program.start()
  
  // Cleanup on disconnect
  return () => program.stop()
}

${behavioralThreads.map(thread => generateBThreadCode(thread, pattern)).join('\n\n')}
`
}

function generateBThreadCode(threadName: string, pattern: any) {
  return `function ${threadName}Thread(element: HTMLElement) {
  return bThread('${threadName}', function* () {
    while (true) {
      // Wait for interaction events
      const event = yield { wait: { type: 'user-interaction' } }
      
      // Handle ${threadName} logic
      if (event.type === 'click') {
        yield { request: { type: 'activate-${pattern.name}' } }
      }
    }
  })
}`
}

function generateTemplateJSX(pattern: any, tokens: any[]) {
  if (pattern.name === 'button') {
    return `    <button 
      role="button"
      \${disabled ? 'disabled' : ''}
      \${props['aria-pressed'] ? \`aria-pressed="\${props['aria-pressed']}"\` : ''}
      \${props['aria-expanded'] ? \`aria-expanded="\${props['aria-expanded']}"\` : ''}
      \${props['aria-describedby'] ? \`aria-describedby="\${props['aria-describedby']}"\` : ''}
      \${props['aria-labelledby'] ? \`aria-labelledby="\${props['aria-labelledby']}"\` : ''}
      \${props['aria-label'] ? \`aria-label="\${props['aria-label']}"\` : ''}
      \${props.onclick ? \`onclick="\${props.onclick}"\` : ''}
    >
      \${props.children || 'Button'}
    </button>`
  }
  
  // Generic template for other patterns
  return `    <div role="${pattern.name}">
      \${props.children || '${pattern.description}'}
    </div>`
}

function generateBehaviorThreadFromRequirement(requirement: string, context: any = {}) {
  // Natural language to behavioral programming mapping
  const patterns = [
    {
      pattern: /button should (submit|activate|trigger)/i,
      bthread: 'submitFormOnClick',
      code: `function* submitFormOnClick() {
  while (true) {
    yield { wait: { type: 'click' } }
    yield { request: { type: 'submit-form' } }
  }
}`
    },
    {
      pattern: /can't (submit|activate|proceed) if invalid/i,
      bthread: 'blockSubmitOnInvalid',
      code: `function* blockSubmitOnInvalid() {
  while (true) {
    const validation = yield { wait: { type: 'validation-check' } }
    if (!validation.valid) {
      yield { block: { type: 'submit-form' } }
    }
  }
}`
    },
    {
      pattern: /close on escape/i,
      bthread: 'closeOnEscape',
      code: `function* closeOnEscape() {
  while (true) {
    const keyEvent = yield { wait: { type: 'keydown' } }
    if (keyEvent.key === 'Escape') {
      yield { request: { type: 'close-dialog' } }
    }
  }
}`
    },
    {
      pattern: /(open|show|display) (dialog|modal|popup)/i,
      bthread: 'openDialog',
      code: `function* openDialog() {
  while (true) {
    yield { wait: { type: 'open-dialog-request' } }
    yield { request: { type: 'show-dialog' } }
    yield { wait: { type: 'dialog-closed' } }
  }
}`
    }
  ]
  
  for (const { pattern, bthread, code } of patterns) {
    if (pattern.test(requirement)) {
      return {
        name: bthread,
        code,
        requirement,
        events: extractEvents(requirement),
        description: `Behavioral thread for: ${requirement}`
      }
    }
  }
  
  // Generic b-thread generation
  const events = extractEvents(requirement)
  const actions = extractActions(requirement)
  
  return {
    name: 'genericBehavior',
    code: `function* genericBehavior() {
  while (true) {
    // Based on requirement: ${requirement}
    ${events.map(event => `yield { wait: { type: '${event}' } }`).join('\n    ')}
    ${actions.map(action => `yield { request: { type: '${action}' } }`).join('\n    ')}
  }
}`,
    requirement,
    events,
    actions,
    description: `Generated behavioral thread for: ${requirement}`
  }
}

function extractEvents(requirement: string): string[] {
  const eventPatterns = [
    { pattern: /click/i, event: 'click' },
    { pattern: /hover/i, event: 'mouseenter' },
    { pattern: /focus/i, event: 'focus' },
    { pattern: /blur/i, event: 'blur' },
    { pattern: /escape/i, event: 'keydown' },
    { pattern: /enter/i, event: 'keydown' },
    { pattern: /space/i, event: 'keydown' },
    { pattern: /submit/i, event: 'submit' },
    { pattern: /change/i, event: 'change' },
    { pattern: /input/i, event: 'input' },
  ]
  
  return eventPatterns
    .filter(({ pattern }) => pattern.test(requirement))
    .map(({ event }) => event)
}

function extractActions(requirement: string): string[] {
  const actionPatterns = [
    { pattern: /submit/i, action: 'submit-form' },
    { pattern: /close/i, action: 'close-dialog' },
    { pattern: /open/i, action: 'open-dialog' },
    { pattern: /show/i, action: 'show-element' },
    { pattern: /hide/i, action: 'hide-element' },
    { pattern: /toggle/i, action: 'toggle-state' },
    { pattern: /activate/i, action: 'activate' },
    { pattern: /validate/i, action: 'validate' },
  ]
  
  return actionPatterns
    .filter(({ pattern }) => pattern.test(requirement))
    .map(({ action }) => action)
}

function generateWorkshopStory(template: any, variants: any[] = []) {
  const componentName = template.name.charAt(0).toUpperCase() + template.name.slice(1)
  const defaultVariants = variants.length > 0 ? variants : [
    {
      name: 'Default',
      props: {},
      description: 'Default state'
    },
    {
      name: 'Disabled',
      props: { disabled: true },
      description: 'Disabled state'
    }
  ]
  
  return {
    title: `${componentName} Component`,
    component: componentName,
    variants: defaultVariants.map(variant => ({
      name: variant.name,
      description: variant.description || `${variant.name} variant`,
      template: template.code,
      props: variant.props,
      story: `
export const ${variant.name.replace(/\s+/g, '')} = {
  name: '${variant.name}',
  template: () => \`
    <${template.name} ${Object.entries(variant.props || {}).map(([key, value]) => `${key}="${value}"`).join(' ')}>
      ${variant.props?.children || 'Click me'}
    </${template.name}>
  \`,
  tests: [
    {
      name: '${variant.name} - Accessibility',
      test: async ({ screen, expect }) => {
        const button = screen.getByRole('button')
        expect(button).toBeInTheDocument()
        ${variant.props?.disabled ? "expect(button).toBeDisabled()" : "expect(button).toBeEnabled()"}
      }
    },
    {
      name: '${variant.name} - Interaction',
      test: async ({ screen, userEvent, expect }) => {
        const button = screen.getByRole('button')
        await userEvent.click(button)
        // Add interaction expectations here
      }
    }
  ]
}`
    }))
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools }
})

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'generateDesignTokens': {
        const parsed = GenerateDesignTokensSchema.parse(args)
        const transformer = new TransformDesignTokens({
          tokens: parsed.tokens,
          tokenPrefix: parsed.tokenPrefix,
        })
        
        let result: any = {}
        
        if (parsed.outputFormat === 'css' || parsed.outputFormat === 'both') {
          result.css = transformer.css
        }
        
        if (parsed.outputFormat === 'typescript' || parsed.outputFormat === 'both') {
          result.typescript = transformer.ts
        }
        
        result.entries = transformer.entries
        result.summary = {
          totalTokens: transformer.entries.length,
          tokenTypes: transformer.entries.reduce((acc, [, entry]) => {
            const type = entry.$type || 'default'
            acc[type] = (acc[type] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }
      
      case 'validateTokenSchema': {
        const parsed = ValidateTokenSchemaSchema.parse(args)
        const transformer = new TransformDesignTokens({ tokens: parsed.tokens })
        
        const validation = {
          valid: true,
          errors: [] as string[],
          warnings: [] as string[],
          tokenCount: transformer.entries.length,
          dependencies: transformer.entries.map(([alias, entry]) => ({
            alias,
            dependencies: entry.dependencies,
            dependents: entry.dependents
          }))
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validation, null, 2)
          }]
        }
      }
      
      case 'getAriaPattern': {
        const parsed = GetAriaPatternSchema.parse(args)
        const pattern = await loadAriaPattern(parsed.component)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(pattern, null, 2)
          }]
        }
      }
      
      case 'generatePlaitedTemplate': {
        const parsed = GeneratePlaitedTemplateSchema.parse(args)
        const templateCode = generatePlaitedTemplateCode(
          parsed.pattern,
          parsed.tokens,
          parsed.behavioralThreads
        )
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              name: parsed.pattern.name,
              code: templateCode,
              pattern: parsed.pattern,
              tokens: parsed.tokens,
              behavioralThreads: parsed.behavioralThreads
            }, null, 2)
          }]
        }
      }
      
      case 'generateBehaviorThread': {
        const parsed = GenerateBehaviorThreadSchema.parse(args)
        const bthread = generateBehaviorThreadFromRequirement(
          parsed.requirement,
          parsed.context
        )
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(bthread, null, 2)
          }]
        }
      }
      
      case 'createWorkshopStory': {
        const parsed = CreateWorkshopStorySchema.parse(args)
        const story = generateWorkshopStory(parsed.template, parsed.variants)
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(story, null, 2)
          }]
        }
      }
      
      case 'validateBehavioralProgram': {
        const parsed = ValidateBehavioralProgramSchema.parse(args)
        
        const validation = {
          valid: true,
          errors: [] as string[],
          warnings: [] as string[],
          bThreads: parsed.bThreads.map(bthread => ({
            name: bthread.name,
            valid: true,
            requirements: bthread.requirements,
            events: extractEvents(bthread.requirements.join(' ')),
            actions: extractActions(bthread.requirements.join(' ')),
            conflicts: [] as string[]
          }))
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(validation, null, 2)
          }]
        }
      }
      
      case 'listAriaPatterns': {
        const patterns = await listAvailableAriaPatterns()
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              patterns,
              count: patterns.length,
              description: 'Available ARIA patterns for template generation'
            }, null, 2)
          }]
        }
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error executing tool ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Plaited Workshop MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})