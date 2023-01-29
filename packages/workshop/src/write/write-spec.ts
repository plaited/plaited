import { startCase } from 'lodash-es'
import fs from 'fs/promises'
import path from 'path'
import { getStat } from '@plaited/node-utils'
import { testExtension, toId } from '../utils/index.js'

const template = ({
  port,
  name,
  title,
  fixture,
  work,
}: {
  port: number,
  name: string,
  title: string,
  fixture: string,
  work: string
}) => {
  const id = toId(title, name)
  const importPlaywright = "import { test, expect } from '@playwright/test'"

  const importAxeCore = "import AxeBuilder from '@axe-core/playwright'"

  const importWork = work ? `import { ${name} } from '${work}'` : ''

  const AccessibilityTest = `test('Accessibility(${title}): ${startCase(name)}', async ({ page }) => {
  await page.goto('http://localhost:${port}/${id}');
  const results = await new AxeBuilder({ page }).options({}).include('${fixture}').analyze();
  expect(results.violations).toHaveLength(0);
})`

  const VisualComparisonTest = `test('Renders(${title}): ${startCase(name)}', async ({ page }) => {
  await page.goto('http://localhost:${port}/${id}');
  expect(await page.screenshot()).toMatchSnapshot('${id}.png');
});`

  const InteractionTest = work ? `test('Interaction(${title}): ${startCase(name)}', async ({ page }) => {
  await page.goto('http://localhost:${port}/${id}');
  await ${name}.play({page, expect, id: ${id}})
});` : ''


  return [
    importPlaywright,
    importAxeCore,
    importWork,
    ' ',
    AccessibilityTest,
    VisualComparisonTest,
    InteractionTest,
  ].filter(Boolean).join('\n')
}

export const writeSpec = async ({
  port,
  name,
  title,
  fixture,
  work,
  output,
}:{
  port: number,
  name: string,
  title: string,
  fixture: string,
  work: string
  output: string,
}) => {
  const id = toId(title, name)
  const testFile = path.resolve(output, `${id}${testExtension}`)
  const exist = await getStat(testFile)
  if(exist) return ''
  const content = template({
    port,
    name,
    title,
    fixture,
    work,
  })
  try {
    await fs.mkdir(path.dirname(testFile),  { recursive: true })
    await fs.writeFile(testFile, content, { encoding: 'utf8' } )
  } catch(err) {
    console.error(err)
  }
  return testFile
}
