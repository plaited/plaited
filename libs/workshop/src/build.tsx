import fg from 'fast-glob'
import path from 'node:path'
import { Request, Response } from 'express'
import { ssr, css } from 'plaited'
import { transformCssTokens } from '@plaited/token-transformer'
import { bundler } from './bundler.js'
import { getStoryMap } from './get-story-map.js'
import { writePlaywrightTests } from './write-playwright-test.js'
import { BuildArgs, HandlerCallback } from './types.js'
import { Page } from './page.js'
import { removeLeadingSlash, LIVE_RELOAD } from './utils.js'


export const build = ({ 
  exts,
  reload,
  srcDir,
  testDir,
  tokens = {},
  baseFontSize,
  protocol,
  port,
}: BuildArgs) => async (
  handlers: Map<string, HandlerCallback>
) => {
  const entryPoints = await fg(path.resolve(srcDir, `**/*${exts.startsWith('.') ? exts : '.' + exts}`))
  const bundles = await bundler({
    srcDir,
    entryPoints,
    reload,
  })

  // Create routes for bundled js
  for(const bundle of bundles) {
    const route = `/${bundle[0]}`
    handlers.set(route, (_: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/javascript')
      res.setHeader('Content-Disposition', `attachment; filename=${path.basename(route)}`)
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
    handlers.set(`/${id}`, (_: Request, res: Response) => {
      return res.send(ssr(<Page 
        id={id}
        reload={reload}
        {...stylesheet}
        clientPath={clientPath}
      ><Template {...attrs} /></Page>))
    })
  }

  // Cleanup dead routes
  for(const key of handlers.keys()) {
    if(key === LIVE_RELOAD) continue
    const formattedKey = removeLeadingSlash(key)
    if(bundles.has(formattedKey) || storyMap.has(formattedKey)) continue
    handlers.delete(key)
  }

  // Build playwright test
  await writePlaywrightTests({ storyMap, testDir, srcDir, port, protocol })
}
