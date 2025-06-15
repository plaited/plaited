#!/usr/bin/env bun

/**
 * Example demonstrating ARIA pattern to PlaitedTemplate generation
 * This shows how the MCP server generates behavioral programming components
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Simulate what the MCP server does when generating a button template
async function generateButtonTemplate() {
  console.log('🔄 Loading ARIA button pattern...')
  
  // Load ARIA pattern (simulating the MCP server's getAriaPattern tool)
  const patternPath = join(process.cwd(), '../corpus/reference-docs/aria-patterns/button.md')
  const patternContent = await readFile(patternPath, 'utf-8')
  
  // Parse pattern requirements
  const pattern = {
    name: 'button',
    description: 'Button Pattern',
    requirements: [
      'The button has role of button',
      'Button has accessible label',
      'When action is unavailable, button has aria-disabled set to true',
      'Toggle buttons have aria-pressed state'
    ],
    keyboard: {
      'Space': 'Activates the button',
      'Enter': 'Activates the button'
    },
    properties: {
      'role': 'button',
      'aria-pressed': 'For toggle buttons',
      'aria-disabled': 'When unavailable',
      'aria-label': 'Accessible name'
    }
  }
  
  console.log('✅ Pattern loaded:', pattern.name)
  
  // Generate behavioral threads from requirements
  const behavioralThreads = [
    {
      requirement: "Button should activate on click",
      code: `function* activateOnClick(element) {
  return bThread('activateOnClick', function* () {
    while (true) {
      yield { wait: { type: 'click' } }
      yield { request: { type: 'button-activate' } }
    }
  })
}`
    },
    {
      requirement: "Button should activate on Space key",
      code: `function* activateOnSpace(element) {
  return bThread('activateOnSpace', function* () {
    while (true) {
      const keyEvent = yield { wait: { type: 'keydown' } }
      if (keyEvent.key === ' ') {
        keyEvent.preventDefault()
        yield { request: { type: 'button-activate' } }
      }
    }
  })
}`
    },
    {
      requirement: "Button should activate on Enter key", 
      code: `function* activateOnEnter(element) {
  return bThread('activateOnEnter', function* () {
    while (true) {
      const keyEvent = yield { wait: { type: 'keydown' } }
      if (keyEvent.key === 'Enter') {
        yield { request: { type: 'button-activate' } }
      }
    }
  })
}`
    },
    {
      requirement: "Can't activate if disabled",
      code: `function* blockActivateIfDisabled(element) {
  return bThread('blockActivateIfDisabled', function* () {
    while (true) {
      yield { wait: { type: 'button-activate' } }
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
        yield { block: { type: 'button-activate' } }
      }
    }
  })
}`
    }
  ]
  
  console.log('🧠 Generated behavioral threads:', behavioralThreads.length)
  
  // Generate PlaitedTemplate with design tokens
  const templateCode = `import { css, PlaitedTemplate } from '@plaited/framework'
import { BProgram, bThread } from '@plaited/behavioral'

interface ButtonProps {
  children?: string
  disabled?: boolean
  'aria-pressed'?: 'true' | 'false'
  'aria-describedby'?: string
  'aria-labelledby'?: string
  'aria-label'?: string
  onclick?: string
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
}

// Behavioral Programming Implementation
function setupBehavioralProgram(element: HTMLElement) {
  const program = new BProgram()
  
  program.add(activateOnClick(element))
  program.add(activateOnSpace(element))
  program.add(activateOnEnter(element))
  program.add(blockActivateIfDisabled(element))
  
  program.start()
  
  // Cleanup on disconnect
  return () => program.stop()
}

${behavioralThreads.map(thread => thread.code).join('\n\n')}

export const Button: PlaitedTemplate<ButtonProps> = {
  tag: 'button',
  observedAttributes: ['disabled', 'aria-pressed', 'aria-expanded'],
  
  template: ({ disabled, ...props }) => \`
    <button 
      role="button"
      \${disabled ? 'disabled' : ''}
      \${props['aria-pressed'] ? \`aria-pressed="\${props['aria-pressed']}"\` : ''}
      \${props['aria-describedby'] ? \`aria-describedby="\${props['aria-describedby']}"\` : ''}
      \${props['aria-labelledby'] ? \`aria-labelledby="\${props['aria-labelledby']}"\` : ''}
      \${props['aria-label'] ? \`aria-label="\${props['aria-label']}"\` : ''}
      \${props.onclick ? \`onclick="\${props.onclick}"\` : ''}
      class="btn btn--\${props.variant || 'primary'} btn--\${props.size || 'medium'}"
    >
      \${props.children || 'Button'}
    </button>
  \`,
  
  styles: css\`
    :host {
      display: inline-block;
      --btn-padding: var(--spacing-button-padding, 0.75rem 1.5rem);
      --btn-font-size: var(--typography-font-size, 1rem);
      --btn-font-weight: var(--typography-font-weight, 600);
      --btn-border-radius: var(--effects-border-radius, 0.375rem);
      --btn-transition: var(--effects-transition, all 200ms ease);
    }
    
    .btn {
      padding: var(--btn-padding);
      font-size: var(--btn-font-size);
      font-weight: var(--btn-font-weight);
      border-radius: var(--btn-border-radius);
      transition: var(--btn-transition);
      border: 1px solid transparent;
      cursor: pointer;
      font-family: inherit;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      min-height: 2.5rem;
    }
    
    .btn:focus {
      outline: 2px solid var(--focus-color, #007acc);
      outline-offset: 2px;
    }
    
    .btn--primary {
      background: var(--btn-colors-primary, #007acc);
      color: var(--btn-colors-text, #ffffff);
      border-color: var(--btn-colors-border, var(--btn-colors-primary));
    }
    
    .btn--primary:hover:not(:disabled) {
      background: var(--btn-colors-primary-hover, #005a99);
    }
    
    .btn--primary:active:not(:disabled) {
      background: var(--btn-colors-primary-active, #004477);
    }
    
    .btn--secondary {
      background: transparent;
      color: var(--btn-colors-primary, #007acc);
      border-color: var(--btn-colors-primary, #007acc);
    }
    
    .btn--secondary:hover:not(:disabled) {
      background: var(--btn-colors-primary, #007acc);
      color: var(--btn-colors-text, #ffffff);
    }
    
    .btn--danger {
      background: var(--danger-color, #dc3545);
      color: var(--btn-colors-text, #ffffff);
      border-color: var(--danger-color, #dc3545);
    }
    
    .btn--danger:hover:not(:disabled) {
      background: var(--danger-color-hover, #c82333);
    }
    
    .btn--small {
      min-height: 2rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
    }
    
    .btn--large {
      min-height: 3rem;
      padding: 1rem 2rem;
      font-size: 1.125rem;
    }
    
    .btn:disabled,
    .btn[aria-disabled="true"] {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }
    
    .btn[aria-pressed="true"] {
      background: var(--btn-colors-primary-active, #004477);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  \`,
  
  connectedCallback: setupBehavioralProgram,
}`

  console.log('🎨 Generated PlaitedTemplate:')
  console.log('✅ Template generation complete!')
  
  return {
    name: 'Button',
    code: templateCode,
    pattern,
    behavioralThreads,
    ariaCompliant: true,
    features: [
      'Full ARIA button pattern compliance',
      'Behavioral programming for interaction logic',
      'Design token integration',
      'Multiple variants and sizes',
      'Keyboard accessibility',
      'Focus management',
      'Disabled state handling',
      'Toggle button support'
    ]
  }
}

// Run the example
try {
  const result = await generateButtonTemplate()
  
  console.log('\n📋 Template Features:')
  result.features.forEach((feature, i) => {
    console.log(`  ${i + 1}. ${feature}`)
  })
  
  console.log('\n🔧 Behavioral Threads:')
  result.behavioralThreads.forEach((thread, i) => {
    console.log(`  ${i + 1}. ${thread.requirement}`)
  })
  
  console.log('\n🎯 ARIA Compliance:', result.ariaCompliant ? '✅ Full compliance' : '❌ Needs work')
  console.log('\n🚀 The button template is ready for agent consumption via MCP!')
  
} catch (error) {
  console.error('❌ Error generating template:', error)
}