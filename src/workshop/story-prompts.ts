import { usePrompt } from '../mcp.js'
import { z } from 'zod'

/**
 * Prompt definitions for generating Plaited component stories
 *
 * These prompts guide AI assistants in creating proper StoryObj definitions
 * that follow Plaited's testing patterns and best practices.
 */

/**
 * Generate Visual/Snapshot Stories Prompt with context-aware completion
 *
 * Creates stories for pure rendering scenarios without interactions.
 * These stories test how components appear with different prop combinations
 * and are ideal for visual regression testing.
 *
 * Key characteristics of generated stories:
 * - No play function (snapshot testing only)
 * - Focus on prop permutations and visual states
 * - Include accessibility attributes
 * - No event handlers (Plaited uses p-trigger for events)
 * - Cover edge cases and boundary conditions
 */
export const generateVisualStories = usePrompt({
  title: 'Generate Visual Stories',
  description:
    'Generate comprehensive visual/snapshot stories for Plaited components covering all prop combinations and states',
  argsSchema: {
    componentName: z.string().describe('Name of the component (e.g., "DecoratedCheckbox")'),
    componentPath: z
      .string()
      .describe('Path to component file relative to project root (e.g., "src/components/DecoratedCheckbox.tsx")'),
    includeAccessibility: z
      .string()
      .optional()
      .describe('Generate stories with ARIA attributes (true/false, default: true)'),
    includeDataTestIds: z.string().optional().describe('Include data-testid attributes (true/false, default: true)'),
  },
  handler: async ({ resolve, args }) => {
    // Parse optional boolean string parameters
    const includeAccessibility = args.includeAccessibility !== 'false' // defaults to true
    const includeDataTestIds = args.includeDataTestIds !== 'false' // defaults to true

    // Build the prompt messages for generating visual stories
    const promptText = `Generate comprehensive visual/snapshot stories for the ${args.componentName} component located at ${args.componentPath}.

Requirements:
- Create stories that test different prop combinations and visual states
- Each story should use the StoryObj type from 'plaited/testing'
- Use "template" and "description" properties (no "render" property)
- NO event handlers in props (Plaited uses p-trigger for events)
${includeAccessibility ? '- Include stories with accessibility attributes (aria-label, aria-describedby, role, etc.)' : ''}
${includeDataTestIds ? '- Include stories with data-testid attributes for testing' : ''}

Focus on:
1. Basic states (default, checked, disabled, etc.)
2. Form-related props (name, value, id, required)
3. Visual variations and edge cases
4. Combinations of multiple props

Import statement should be:
import { type StoryObj, type Args } from 'plaited/testing'
import { ${args.componentName} } from '${args.componentPath}'

type ${args.componentName}Args = Args<typeof ${args.componentName}>

Generate stories that thoroughly test the component's visual states.`

    resolve({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptText,
          },
        },
      ],
    })
  },
})

/**
 * Generate Interaction Stories Prompt with context-aware completion
 *
 * Creates stories with play functions for testing component behavior.
 * These stories validate functionality, state changes, and user interactions
 * using Plaited's instrumented testing utilities.
 *
 * Key characteristics of generated stories:
 * - Include play function with testing logic
 * - Use ONLY instrumented methods (findByAttribute, findByText, fireEvent)
 * - NEVER use document.querySelector or native DOM methods
 * - Test actual behavior and state changes
 * - Include proper assertions with given/should/actual/expected
 * - Handle async operations correctly
 */
export const generateInteractionStories = usePrompt({
  title: 'Generate Interaction Stories',
  description:
    'Generate interaction stories with play functions for testing Plaited component behavior and user interactions',
  argsSchema: {
    componentName: z.string().describe('Name of the component (e.g., "DecoratedCheckbox")'),
    componentPath: z.string().describe('Path to component file relative to project root'),
    testScenarios: z
      .string()
      .optional()
      .describe(
        'Comma-separated list of scenarios: state-changes, user-clicks, keyboard-navigation, form-interaction, validation, accessibility-features, async-behavior, error-handling (default: state-changes,user-clicks)',
      ),
    existingStoryPath: z.string().optional().describe('Path to existing story file for reference patterns'),
  },
  handler: async ({ resolve, args }) => {
    // Parse test scenarios from comma-separated string
    const scenarios = args.testScenarios?.split(',').map((s: string) => s.trim()) || ['state-changes', 'user-clicks']

    // Build scenario-specific requirements
    const scenarioRequirements = scenarios
      .map((scenario) => {
        switch (scenario) {
          case 'state-changes':
            return '- Test component state transitions (checked/unchecked, enabled/disabled, etc.)'
          case 'user-clicks':
            return '- Test click interactions and their effects on component state'
          case 'keyboard-navigation':
            return '- Test keyboard interactions (Space, Enter, Tab navigation)'
          case 'form-interaction':
            return '- Test form submission, validation, and value changes'
          case 'validation':
            return '- Test required fields, input validation, and error states'
          case 'accessibility-features':
            return '- Test ARIA attributes, screen reader announcements, and focus management'
          case 'async-behavior':
            return '- Test loading states, async operations, and promises'
          case 'error-handling':
            return '- Test error states, invalid inputs, and edge cases'
          default:
            return `- Test ${scenario}`
        }
      })
      .join('\n')

    const existingStoryNote =
      args.existingStoryPath ? `\nReference the patterns used in: ${args.existingStoryPath}` : ''

    // Build the prompt messages for generating interaction stories
    const promptText = `Generate interaction stories with play functions for the ${args.componentName} component located at ${args.componentPath}.

Requirements:
- Each story MUST have a play function for testing interactions
- Import and use ONLY these instrumented testing methods:
  * findByAttribute('p-target', 'value') or findByAttribute('type', 'checkbox')
  * findByText('text content')
  * fireEvent(element, 'event')
  * assert({ given, should, actual, expected })
  * wait(ms) for delays
- NEVER use document.querySelector, getElementById, or any native DOM methods
- Use proper TypeScript types: findByAttribute<HTMLInputElement>()
- Each assertion must have given, should, actual, and expected properties
${existingStoryNote}

Test Scenarios to Cover:
${scenarioRequirements}

Import statement should be:
import { type StoryObj, type Args } from 'plaited/testing'
import { ${args.componentName} } from '${args.componentPath}'

type ${args.componentName}Args = Args<typeof ${args.componentName}>

Example play function structure:
async play({ findByAttribute, findByText, fireEvent, assert, wait }) {
  const element = await findByAttribute<HTMLInputElement>('type', 'checkbox')
  await fireEvent(element!, 'click')

  assert({
    given: 'user clicks checkbox',
    should: 'toggle checked state',
    actual: element?.checked,
    expected: true
  })
}

Generate comprehensive interaction stories that test the component's behavior.`

    resolve({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: promptText,
          },
        },
      ],
    })
  },
})
