import { dirname, resolve } from './libs/deps.ts'
import { start } from './libs/workshop/start.ts'

const configPath = resolve(Deno.cwd(), Deno.args[0])
const configDir = dirname(configPath)
const { default: config } = await import(configPath)

start({
  ...config,
  playwright: resolve(configDir, config.playwright),
  importMap: resolve(configDir, config.importMap),
  assets: resolve(configDir, config.assets),
  root: resolve(configDir, config.root),
})
