import { mkdir } from 'node:fs/promises'
import fg from 'fast-glob'
import { Config } from './types.js'
import { bundler } from './bundler.js'
import { Server } from './server.js'
export const workshop = async ({
  assets,
  tests = '.playwright',
  port = 3000,
  tokens,
  output = '.transformed',
  stories,
  reload = true,
}: Config) => {
  const testDir = `${process.cwd()}/${tests}`
  await mkdir(testDir, { recursive: true })
  let transformedDir: string | undefined
  if(tokens) {
    transformedDir = `${process.cwd()}/${output}`
    await mkdir(transformedDir, { recursive: true })
  }
  const routes = new Server(assets, reload)
  const entryPoints = await fg(`${process.cwd()}/${stories}`)
  const bundles = await bundler(entryPoints, reload)
  for(const bundle of bundles) {
    // routes.set(bundle[0], (_, res) => {
    //   res.end(bundle[1])
    // })
  }

}
