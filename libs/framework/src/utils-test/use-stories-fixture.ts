import { AxeBuilder } from '@axe-core/playwright'
import type axe from 'axe-core'
import type { Parameters } from './types.js'
import { STORYBOOK_PATH_ROOT } from './constants.js'
import { BrowserType, chromium, devices } from 'playwright'
import { ValueOf } from '../utils.js'

declare global {
  function useStory(arg: { path: string; params: Parameters }): Promise<(string | axe.Result)[]>
}

export const useStoriesFixture = async (args?: { browserType?: BrowserType; root?: string; cwd?: string }) => {
  const { browserType = chromium, root = STORYBOOK_PATH_ROOT, cwd = process.cwd() } = args || {}
  const beforeAll = async () => {
    const browser = await browserType.launch({ headless: true })
    globalThis.useStory = async ({
      path,
      params,
      colorScheme = 'light',
      device,
      record,
    }: {
      path: string
      params: Parameters
      colorScheme?: 'light' | 'dark'
      device?: ValueOf<typeof devices>
      record?: boolean
    }) => {
      const recordVideo = record ? { dir: `${cwd}/.plaited` } : undefined
      const context = await browser.newContext({ recordVideo, colorScheme, ...device })
      const violations: (axe.Result | string)[] = []
      const { a11y } = params
      const page = await context.newPage()
      page.on('pageerror', (exception) => {
        violations.push(exception.message)
      })
      page.goto(`${root}/${path}`)
      const axe = await new AxeBuilder({ page }).options({ rules: a11y }).include(root).analyze()
      violations.push(...axe.violations)
      await context.close()
      return violations
    }
  }
  const afterAll = () => {
    //@ts-ignore: cleanup
    globalThis.useStory = undefined
  }
  return { beforeAll, afterAll }
}
