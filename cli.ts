import { dirname, resolve } from './libs/deps.ts'
import { startWorkshop } from './libs/workshop/start-workshop.ts'
const getConfig = async () => {
  const configPath = resolve(Deno.cwd(), Deno.args[1])
  const configDir = dirname(configPath)
  const { default: config } = await import(configPath)
  return { config, configDir }
}

const workshop = async () => {
  const { config, configDir } = await getConfig()
  const workspace = config.workspace && config.workspace.startsWith('/')
    ? config.workspace
    : config.workspace
    ? resolve(configDir, config.workspace)
    : Deno.cwd()

  const assets = config.assets && config.assets.startsWith('/')
    ? config.assets
    : config.assets
    ? resolve(configDir, config.assets)
    : resolve(Deno.cwd(), './.workshop')

  const playwright = config.playwright && config.playwright.startsWith('/')
    ? config.playwright
    : config.playwright
    ? resolve(configDir, config.playwright)
    : resolve(Deno.cwd(), './playwright')

  const exts = {
    worker: config.worker,
    island: config.island || '.island.ts',
    story: config.story || '.stories.ts',
  }

  const importMap = config.importMap
    ? resolve(configDir, config.importMap)
    : undefined

  await startWorkshop({
    ...config,
    assets,
    exts,
    importMap,
    playwright,
    workspace,
  })
}

const [task] = Deno.args

const tasks: Record<
  string,
  (...args: unknown[]) => unknown | Promise<unknown>
> = {
  workshop,
}

if (Object.hasOwn(tasks, task)) {
  await tasks[task]()
}
