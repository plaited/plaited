import { kebabCase } from '@plaited/utils'
import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

/**
 * 
 * @description When pass a port number it will find an open port
 * @returns number
 */
export const findOpenPort = async (startPort: number): Promise<number> =>{
  let port = startPort
  const portIsOpen = async port => {
    return new Promise(resolve => {
      const server = net.createServer()

      server.once('error', (err: { code: string}) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false)
        }
      })

      server.once('listening', () => {
        server.close()
        resolve(true)
      })

      server.listen(port)
    })
  }
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const isOpen = await portIsOpen(port)
    if (isOpen) {
      return port
    }
    port++
  }
}


// Create story id from story set tile and story export name
export const toId = (title: string, name: string) =>
  `${kebabCase(title)}--${kebabCase(name)}`

// used to remove leading slash from handler keys fro cleaning up handlers map
export const removeLeadingSlash = (input: string): string => {
  if (input.startsWith('/')) {
    return input.slice(1)
  }
  return input
}

// Live reload constant value
export const LIVE_RELOAD = '/livereload'

/** 
 * @description This utility function takes an array of entry points used by bundler
 * the the bundle map and the source directory path for the original src files and
 * writes the bundles to a temporary directory. It then returns an array containing formatted
 * entry paths and the tmp directory path 
 */
export const createTmpDir = async ({
  entryPoints,
  bundles,
  srcDir,
}:{
  srcDir: string
  entryPoints: string[]
  bundles: Map<string, Uint8Array>
}): Promise<[string[], string]> => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'plaited-workshop-'))
  const formattedEntries = entryPoints.map(entry => entry.replace(new RegExp(`^${srcDir}`), '' ))
  const pkg = JSON.stringify({
    type: 'module',
  })
  await fs.writeFile(path.join(tempDirectory, 'package.json'), pkg)
  for(const [ filePath, data ] of bundles) {
    const tempFile = path.join(tempDirectory, filePath)
    const dir = path.dirname(tempFile)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(tempFile, data)
  }
  return [ formattedEntries, tempDirectory ]
}

export const remap = (filePath: string)  => filePath.replace(/\.tsx?$/, '.js')
