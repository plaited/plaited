import fg from 'fast-glob'
import path from 'node:path'
import fs from 'node:fs/promises'
import { Request, Response } from 'express'
import { ssr, css } from 'plaited'
import { transformCssTokens } from '@plaited/token-transformer'
import { bundler } from './bundler.js'
import { getStoryMap } from './get-story-map.js'
import { writePlaywrightTests } from './write-playwright-test.js'
import { BuildArgs, HandlerCallback } from './types.js'
import { Page } from './page.js'
import { removeLeadingSlash, LIVE_RELOAD, createTmpDir } from './utils.js'

export const build = ({ 
  exts,
  reload,
  srcDir,
  testDir,
  tokens = {},
  baseFontSize,
  protocol,
  port,
  info,
}: BuildArgs) => async (
  handlers: Map<string, HandlerCallback>
) => {
  const entryPoints = await fg(path.join(srcDir, `**/*${exts.startsWith('.') ? exts : '.' + exts}`))
  let bundles: Map<string, Uint8Array>
  try {
    bundles = await bundler({
      srcDir,
      entryPoints,
      reload,
    })
  } catch (error){
    console.error(error)
  }
  if(bundles.size) {

    // Create routes for bundled js
    for(const bundle of bundles) {
      const route = bundle[0]
      handlers.set(route, (_: Request, res: Response) => {
        res.setHeader('Content-Type', 'application/javascript')
        res.setHeader('Content-Disposition', `attachment; filename=${path.basename(route)}`)
        res.send(Buffer.from(bundle[1]))
      })
    }
  
    // create temp directory to write bundles to get story map
    const [ formattedEntries, tempDirectory ] = await createTmpDir({ entryPoints, bundles, srcDir })
  
    // Get story map
    const storyMap = await getStoryMap(formattedEntries, tempDirectory)
  
    // Clean up tmp directory
    await fs.rm(tempDirectory, { recursive:true })

    // Apply default styles
    const [ _, stylesheet ] = css`
  html {
    font-size: ${baseFontSize}px;
  }
  body {
    width: 100%;
    height: 100vh
  }
  #root{
    width: 100%;
    height: 100%;
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
      if(bundles.has(key) || storyMap.has(removeLeadingSlash(key))) continue
      handlers.delete(key)
    }

    // Build playwright test
    await writePlaywrightTests({ storyMap, testDir, srcDir, port, protocol })
    
    // Update info Map on build
    info.clear()
    for(const [ id, { srcPath, name, title } ] of storyMap) {
      info.set(id, {
        title,
        name,
        url: `${protocol}://localhost:${port}/${id}`,
        srcPath: path.join(srcDir, srcPath),
        testPath: path.join(
          testDir,
          path.dirname(srcPath),
          `${id}.spec.ts`
        ) })
    }
  }
}
