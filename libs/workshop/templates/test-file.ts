import { StoryData } from '../types.ts'
import { accessibilityAssertion } from './accessibility-assertion.ts'
import { visualComparisonAssertion } from './visual-comparison-assertion.ts'
import { interactionAssertion } from './interaction-assertion.ts'
import { basename, dirname, relative } from '../../deps.ts'
import { toId } from '../to-id.ts'

type TestDescribeTemplate = (args: {
  colorScheme: boolean
  data: StoryData[]
  port: number
  project?: string
  storiesPath: string
  testPath: string
  title: string
}) => string

const useColorScheme = (scheme: 'light' | 'dark') =>
  `test.use({ colorScheme: '${scheme}' })\n  `

export const testFile: TestDescribeTemplate = ({
  colorScheme,
  data,
  title,
  storiesPath,
  testPath,
}) => {
  const names: string[] = []
  const path = relative(dirname(testPath), storiesPath)
  const stories = `./${dirname(path)}/${basename(path)}`.replace('.ts', '.js')

  const content: string[] = []
  for (const { name } of data) {
    names.push(name)
    const id = toId(title, name)
    content.push(`test('${name}', async ({ page }) => {
    await page.goto('./${id}')
    ${accessibilityAssertion()}
    ${visualComparisonAssertion(id)}
    ${interactionAssertion(name, id)}
  })`)
  }

  return `/** GENERATED TEST FILE DO NOT EDIT **/
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { ${names.join('\n')}} from '${stories}'

test.describe('${title}${colorScheme ? '(light)' : ''}', () => {
  ${colorScheme ? useColorScheme('light') : ''}${content.join('\n')}
})
${
    colorScheme
      ? `test.describe('${title}(dark)', () => {
  ${colorScheme ? useColorScheme('dark') : ''}${content.join('\n')}
})
/** GENERATED TEST FILE DO NOT EDIT **/`
      : '/** GENERATED TEST FILE DO NOT EDIT **/'
  }`
}
