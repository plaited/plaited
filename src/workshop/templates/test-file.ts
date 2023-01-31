import { StoryData } from '../types.ts'
import { toId } from '../to-id.ts'
import { accessibilityAssertion } from './accessibility-assertion.ts'
import {visualComparisonAssertion} from './visual-comparison-assertion.ts'
import { interactionAssertion } from './interaction-assertion.ts'
import { relative } from '../../deps.ts'
type TestDescribeTemplate = (args:{
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
  const content = data.map(({name, fixture, }) => {
    names.push(name)
    const id = toId(title, name)
  return `test('${name}', async ({ page }) => {
  await page.goto('./${toId(title, name)}')
  ${accessibilityAssertion(fixture)}

  ${visualComparisonAssertion(fixture, id)}

  ${interactionAssertion(name, id)}
})
`
}).join('\n')

return `import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  ${names.join('\n')}
} from '${relative(testPath, storiesPath)}'
test.describe('${title}${colorScheme ? '(light)' : ''}', () => {
  test.use({ colorScheme: ${colorScheme ? 'light' : 'normal'} })
  ${content}
})

${colorScheme? `test.describe('${title}${colorScheme ? '(light)' : ''}', () => {
  test.use({ colorScheme: 'dark' })
  ${content}
})` : ''}
`
}
  
