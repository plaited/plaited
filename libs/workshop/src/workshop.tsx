import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { Request, Response } from 'express'
import { ssr, css } from 'plaited'
import { transformCssTokens, defaultBaseFontSize } from '@plaited/token-transformer'
import { getServer } from './get-server.js'
import { Config, AddRoute } from './types.js'
import { bundler } from './bundler.js'
import { getStoryMap } from './get-story-map.js'
import { buildPlaywrightTests } from './build-playwright-test.js'
import { Page } from './page.js'


const build = ({ 
  exts,
  reload,
  srcDir,
  testDir,
  tokens = {},
  baseFontSize,
}: Omit<Config, 'assets' | 'port'>) => async (
  add: AddRoute
) => {
  const entryPoints = await fg(path.resolve(srcDir, `**/*${exts.startsWith('.') ? exts : '.' + exts}`))
  const bundles = await bundler({
    srcDir,
    entryPoints,
    reload,
  })
  // Create routes for bundled js
  for(const bundle of bundles) {
    add(`/${bundle[0]}`, (_: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript')
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(bundle[0])}`)
      res.send(Buffer.from(bundle[1]))
    })
  }
  // Get story map
  const storyMap = await getStoryMap(entryPoints, srcDir)

  // Apply default styles
  const [ _, stylesheet ] = css`
  html {
    font-size: ${baseFontSize}px;
  }
  ${transformCssTokens({ tokens, baseFontSize })}
  `

  // Add story routes
  for(const [ id, { clientPath, template: Template, attrs } ] of storyMap) {
    add(`/${id}`, (_: Request, res: Response) => {
      return res.send(ssr(<Page 
        id={id}
        reload={reload}
        {...stylesheet}
        clientPath={clientPath}
      ><Template {...attrs} /></Page>))
    })
  }

  // Build playwright test
  await buildPlaywrightTests({ storyMap, testDir, srcDir })
}

export const workshop = async ({
  assets,
  exts,
  port = 3000,
  reload = true,
  srcDir: _srcDir,
  testDir: _testDir = '.playwright',
  tokens,
  baseFontSize = defaultBaseFontSize,
}: Config) => {
  // Setup src and test dir if they don't exist
  const srcDir = path.resolve(process.cwd(), _srcDir)
  const testDir = path.resolve(process.cwd(), _testDir)
  await fs.mkdir(srcDir, { recursive: true })
  await fs.mkdir(testDir, { recursive: true })

  const rebuild = build({
    exts,
    reload,
    srcDir,
    testDir,
    tokens,
    baseFontSize, 
  })

  const server = await getServer({
    assets,
    reload,
    srcDir,
    rebuild,
    port,
  })

  // Start server
  server.start()
}
