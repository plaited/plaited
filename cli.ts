import { dirname, resolve } from './libs/deps.ts'
import {
  DesignTokenGroup,
  easyTokenSchema,
  TokenConfig,
  tokenTransformer,
} from './token-utils.ts'

const getStat = async (
  filePath: string,
): Promise<false | Deno.FileInfo> => {
  try {
    const entry = await Deno.stat(filePath)
    return entry
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false
    }
    throw error
  }
}

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
  'token-transform': tokenTransform,
  'tt': tokenTransform,
  'token-schema': tokenSchema,
  'ts': tokenSchema,
}

if (Object.hasOwn(tasks, task)) {
  await tasks[task]()
}
