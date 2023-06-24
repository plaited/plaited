import fs from 'node:fs/promises'
import path from 'node:path'
import { defaultBaseFontSize } from '@plaited/token-transformer'
import { initServer } from './init-server.js'
import { Config } from './types.js'
import { build } from './build.js'
import { findOpenPort } from './utils.js'

export const workshop = async ({
  assets,
  exts,
  port:_port = 3000,
  reload = true,
  srcDir: _srcDir,
  testDir: _testDir = '.playwright',
  tokens,
  baseFontSize = defaultBaseFontSize,
  sslCert,
}: Config) => {
  // Setup src and test dir if they don't exist
  const srcDir = path.resolve(process.cwd(), _srcDir)
  const testDir = path.resolve(process.cwd(), _testDir)
  await fs.mkdir(srcDir, { recursive: true })
  await fs.mkdir(testDir, { recursive: true })
  // Make sure default port or port passed in is available
  const port = await findOpenPort(_port)
  // Prime the build function to be used on reloads
  const rebuild = build({
    exts,
    reload,
    srcDir,
    testDir,
    tokens,
    baseFontSize, 
    protocol: sslCert ? 'https' : 'http',
    port,
  })
  // Initialize server
  const server = await initServer({
    assets,
    reload,
    srcDir,
    rebuild,
    port,
    sslCert,
  })

  return server
}
