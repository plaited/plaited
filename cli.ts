import { dirname, resolve } from './libs/deps.ts'
import { startWorkshop } from './libs/workshop/start-workshop.ts'
import { WorkshopConfig } from './libs/workshop/mod.ts'
import { tokenTransformer } from './libs/token-transformer/mod.ts'
import { easyTokenSchema } from './libs/easy-token-schema/mod.ts'
import { DesignTokenGroup, TokenConfig } from './libs/token-types.ts'
import { getStat } from './libs/workshop/get-stat.ts'

const getConfig = async () => {
  const configPath = resolve(Deno.cwd(), Deno.args[1])
  const exist = await getStat(configPath)
  if (!exist) {
    console.error(
      `Config [${configPath}] not found. Path should be relative to the current working directory`,
    )
    Deno.exit(1)
  }
  const configDir = dirname(configPath)
  const { default: config } = await import(configPath)
  return { config, configDir }
}

const workshop = async () => {
  const { config, configDir } = await getConfig()
  let { workspace, assets, playwright, exts, importMap } =
    config as WorkshopConfig
  workspace = config.workspace && config.workspace.startsWith('/')
    ? config.workspace
    : config.workspace
    ? resolve(configDir, config.workspace)
    : configDir

  assets = config.assets && config.assets.startsWith('/')
    ? config.assets
    : config.assets
    ? resolve(configDir, config.assets)
    : resolve(configDir, './workshop')

  playwright = config.playwright && config.playwright.startsWith('/')
    ? config.playwright
    : config.playwright
    ? resolve(configDir, config.playwright)
    : resolve(configDir, './playwright')

  importMap = importMap ? resolve(configDir, importMap) : undefined

  await startWorkshop({
    ...config,
    assets,
    exts: {
      ...exts,
      island: exts?.island || '.island.ts',
      story: exts?.story || '.stories.ts',
    },
    importMap,
    playwright,
    workspace,
  })
}

const tokenTransform = async () => {
  const { config, configDir } = await getConfig()
  const { tokens, transform = {} } = config as TokenConfig
  if (!tokens) {
    console.error(
      'Design Tokens not found. Make sure the token group object isn\'t missing from your config',
    )
    Deno.exit()
  }
  const output = transform?.output
    ? resolve(configDir, transform.output)
    : resolve(configDir, './tokens')
  await tokenTransformer({
    ...transform,
    tokens,
    output,
  })
}

const tokenSchema = async () => {
  const { config, configDir } = await getConfig()
  const { tokens, schema } = config as TokenConfig
  if (!tokens) {
    console.error(
      'Design Tokens not found. Make sure the token group object isn\'t missing from your config',
    )
    Deno.exit()
  }
  const output = schema?.output
    ? resolve(configDir, schema.output)
    : resolve(configDir, './tokens')
  await easyTokenSchema({
    tokens: tokens as DesignTokenGroup,
    name: schema?.name,
    output,
  })
}

const help = () => {
  console.log(` 
    
  `)
}

const [task] = Deno.args

const tasks: Record<
  string,
  (...args: unknown[]) => unknown | Promise<unknown>
> = {
  help,
  '-h': help,
  workshop,
  'w': workshop,
  'token-transform': tokenTransform,
  'tt': tokenTransform,
  'token-schema': tokenSchema,
  'ts': tokenSchema,
}

if (Object.hasOwn(tasks, task)) {
  await tasks[task]()
}
