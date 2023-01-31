import { startCase } from '../../deps.ts'
import { toId } from '../utils/mod.ts'
const template = ({
  port,
  name,
  title,
  fixture,
  storiesExportFile,
}: {
  port: number,
  name: string,
  title: string,
  fixture: string,
  storiesExportFile: string
}) => {
  const id = toId(title, name)
  const importPlaywright = "import { test, expect } from '@playwright/test'"

  const importAxeCore = "import AxeBuilder from '@axe-core/playwright'"

  const importWork = `import { ${name} } from '${storiesExportFile}'`



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

const encoder = new TextEncoder()

export const writeSpec = async ({
  port,
  name,
  title,
  fixture,
  storiesExportFile,
  outputDir,
  testExtension
}:{
  port: number,
  name: string,
  title: string,
  fixture: string,
  storiesExportFile: string
  outputDir: string,
  testExtension: string
}) => {
  const id = toId(title, name)
  const testFile =`${outputDir}/${id}${testExtension.startsWith('.') ? testExtension : `.${testExtension}`}`
  const exist = Deno.statSync(testFile)
  if(exist) return ''
  const content = template({
    port,
    name,
    title,
    fixture,
    storiesExportFile,
  })
  
  try {
    await Deno.writeFile(testFile, encoder.encode(content))
  } catch(err) {
    console.error(err)
  }
  return testFile
}
