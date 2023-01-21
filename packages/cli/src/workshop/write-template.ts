import { toId } from './to-id'
import { startCase } from 'lodash-es'
import fs from 'fs/promises'
import path from 'path'
import { getStat } from '../shared/get-stat'
export const template = ({
  port,
  name,
  title,
  fixtureTag,
  workPath,
}: {
  port: number,
  name: string,
  title: string,
  fixtureTag: string,
  workPath: string
}) => {
  const id = toId(title, name)
  const importPlaywright = "import { test, expect } from '@playwright/test'"

  const importAxeCore = "import AxeBuilder from '@axe-core/playwright'"

  const importWork = workPath ? `import { ${name} } from '${workPath}'` : ''

  const AccessibilityTest = `test('Accessibility(${title}): ${startCase(name)}', async ({ page }) => {
  await page.goto('http://localhost:${port}/${id}');
  const results = await new AxeBuilder({ page }).options({}).include('${fixtureTag}').analyze();
  expect(results.violations).toHaveLength(0);
})`

  const VisualComparisonTest = `test('Renders(${title}): ${startCase(name)}', async ({ page }) => {
  await page.goto('http://localhost:${port}/${id}');
  expect(await page.screenshot()).toMatchSnapshot('${id}.png');
});`

  const InteractionTest = workPath ? `test('Interaction(${title}): ${startCase(name)}', async ({ page }) => {
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

const writeTemplate = async ({
  port,
  name,
  title,
  fixtureTag,
  workPath,
  output,
}:{
  port: number,
  name: string,
  title: string,
  fixtureTag: string,
  workPath: string
  output,
}) => {
  const id = toId(title, name)
  const testFile = path.resolve(output, id)
  const exist = await getStat(testFile)
  if(exist) return
  fs.writeFile()
}
