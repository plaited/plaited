import fs from 'node:fs/promises'
import path from 'node:path'
import { defaultBaseFontSize } from '@plaited/token-transformer'
import { getServer } from './get-server.js'
import { Config } from './types.js'
import { build } from './build.js'
import { findOpenPort } from './find-open-port.js'

export const workshop = async ({
  assets,
  exts,
  port:_port = 3000,
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
  const protocol = 'http'

  const port = await findOpenPort(_port)

  const rebuild = build({
    exts,
    reload,
    srcDir,
    testDir,
    tokens,
    baseFontSize, 
    protocol,
    port,
  })

  const start = await getServer({
    assets,
    reload,
    srcDir,
    rebuild,
    port,
    protocol,
  })

  // Start server
  start()
}
