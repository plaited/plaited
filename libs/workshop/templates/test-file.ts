import { StoryData } from '../types.ts'
import { accessibilityAssertion } from './accessibility-assertion.ts'
import { visualComparisonAssertion } from './visual-comparison-assertion.ts'
import { interactionAssertion } from './interaction-assertion.ts'
import { basename, dirname, kebabCase, relative } from '../../deps.ts'
import { toId } from '../to-id.ts'
import { fixture } from '../constants.ts'

type TestDescribeTemplate = (args: {
  colorScheme: boolean
  data: StoryData[]
  port: number
  project?: string
  storiesPath: string
  testPath: string
  title: string
}) => string

export const testFile: TestDescribeTemplate = ({
  colorScheme,
  data,
  title,
  storiesPath,
  testPath,
}) => {
  const names: string[] = []
  const path = relative(dirname(testPath), storiesPath)
  const stories = `${dirname(path)}/${basename(path)}`.replace('.ts', '.js')

  const content: string[] = []
  for (const { name, island = fixture } of data) {
    const dashedName = kebabCase(name)
    names.push(dashedName)
    const id = toId(kebabCase(title), dashedName)
    content.push(`test('${name}', async ({ page }) => {
    await page.goto('./${id}')
    ${accessibilityAssertion(island)}

    ${visualComparisonAssertion(island, id)}

    ${interactionAssertion(name, id)}
  })
`)
  }

  return `import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ${names.join('\n')}} from '${stories}'

test.describe('${title}${colorScheme ? '(light)' : ''}', () => {
  test.use({ colorScheme:' ${colorScheme ? 'light' : 'normal'}' })
  ${content.join('\n')}
})
${
    colorScheme
      ? `test.describe('${title}${colorScheme ? '(light)' : ''}', () => {
  test.use({ colorScheme: 'dark' })
  ${content.join('\n')}
})`
      : ''
  }`
}
