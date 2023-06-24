import fg from 'fast-glob'
import path from 'path'
import fs from 'node:fs/promises'
import { StoryMap } from './types.js'

const template = (
  {
    id,
    name,
    title,
    path,
    play,
    protocol,
    port,
    options,
  }: {
    id: string,
    name: string,
    title: string,
    path: string
    play: boolean
    protocol: 'http' | 'https'
    port: number
    options: {
      a11y: boolean,
      snapshot: boolean
    }
  }
) => {

  const importStory = `import { ${name} } from '${path}'`

  const importPlaywright = "import { test, expect } from '@playwright/test'"

  const importAxeCore =  "import AxeBuilder from '@axe-core/playwright'"

  const beforeEach = `test.beforeEach(async ({ page }) => {
  await page.goto('${protocol}://localhost:${port}/${id}')
});`

  const accessibilityTest = `test('Accessibility check ${title}: ${name} story', async ({ page }) => {
  //@ts-ignore: {@link  https://github.com/dequelabs/axe-core-npm/issues/601}
  const results = await new AxeBuilder.default({ page }).options({}).include('#root').analyze();
  expect(results.violations).toHaveLength(0);
})`

  const visualComparisonTest = `test('Renders ${title}: ${name} story', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('${id}.png');
});`

  const interactionTest = `test('Interaction ${title}: ${name} story', async (testArgs, testInfo) => {
    ${name}.play && await ${name}.play(expect, testArgs, testInfo)
});`

  return [
    importPlaywright,
    importAxeCore,
    play && importStory,
    ' ',
    beforeEach,
    options?.a11y && accessibilityTest,
    options?.snapshot && visualComparisonTest,
    play && interactionTest,
  ].filter(Boolean).join('\n')
}

export const writePlaywrightTests = async (
  {
    storyMap,
    testDir,
    srcDir,
    protocol,
    port,
  }:{
    storyMap: StoryMap, 
    testDir: string
    srcDir: string
    protocol: 'http' | 'https'
    port: number
  }
) => {
  await fs.mkdir(testDir, { recursive: true })
  // Glob old tests
  const oldTests = await fg(path.resolve(testDir, '**/*.spec.ts'))
  // Cleanup test no longer needed
  oldTests.length && await Promise.all(
    oldTests.map(async filePath => {
      const fileBaseName = path.basename(filePath, '.spec.ts')
      // Check if the id of the old test file is in the storyDataIds Set
      if (!storyMap.has(fileBaseName)) {
        await fs.rm(filePath)
        console.log(`Removed old test file: "${filePath}"`)
      }
    })
  )
  // Write test files
  await Promise.all(
    [ ...storyMap ].map(async ([ id, { name, title, srcPath, clientPath, play, options = {} } ]) => {
      const filePath = path.resolve(
        testDir,
        path.dirname(path.relative(srcDir, srcPath)),
        `${id}.spec.ts`  
      ) 
      
      const dir = path.dirname(filePath)
      await fs.mkdir(dir, { recursive: true })

      await fs.writeFile(filePath, template({
        id,
        name,
        path: path.relative(testDir, srcPath).replace(/\.tsx?$/, '.js'),
        title,
        play,
        protocol,
        port,
        options: {
          a11y: true,
          snapshot: true,
          ...options,
        },
      }))
    })
  )
}
