import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { BootstrapInput, BootstrapOutput } from './bootstrap.types.ts'

const ensureDir = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true })
}

const writeJsonFile = async ({
  path,
  data,
  overwrite,
}: {
  path: string
  data: unknown
  overwrite: boolean
}): Promise<void> => {
  if (!overwrite && (await Bun.file(path).exists())) {
    throw new Error(`Refusing to overwrite existing file: ${path}`)
  }
  await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`)
}

const writeTextFile = async ({
  path,
  content,
  overwrite,
}: {
  path: string
  content: string
  overwrite: boolean
}): Promise<void> => {
  if (!overwrite && (await Bun.file(path).exists())) {
    throw new Error(`Refusing to overwrite existing file: ${path}`)
  }
  await Bun.write(path, content)
}

const getNextSteps = ({
  configPath,
  sandboxProvider,
  syncProvider,
}: {
  configPath: string
  sandboxProvider: BootstrapInput['sandboxProvider']
  syncProvider: BootstrapInput['syncProvider']
}): string[] => {
  const steps = [
    `Review bootstrap manifest at ${configPath}`,
    'Run `plaited bootstrap --schema input` to inspect the command contract',
    'Install the bootstrap-plaited-agent skill in agents that should manage deployment through the CLI',
  ]

  if (sandboxProvider === 'boxer') {
    steps.push('Provision the Boxer runtime or equivalent sandbox adapter before enabling autonomous execution')
  }
  if (syncProvider === 'turso') {
    steps.push('Configure Turso/libSQL replication credentials before enabling sync')
  }

  return steps
}

export const bootstrapAgent = async (input: BootstrapInput): Promise<BootstrapOutput> => {
  const targetDir = resolve(input.targetDir)
  const plaitedDir = join(targetDir, '.plaited')
  const memoryDir = join(plaitedDir, 'memory')
  const runtimeDir = join(plaitedDir, 'runtime')
  const configDir = join(plaitedDir, 'config')

  await ensureDir(plaitedDir)
  await ensureDir(memoryDir)
  await ensureDir(runtimeDir)
  await ensureDir(configDir)

  const configPath = join(configDir, 'bootstrap.json')
  const modelsPath = join(configDir, 'models.json')
  const infrastructurePath = join(configDir, 'infrastructure.json')
  const observationsPath = join(memoryDir, 'observations.jsonl')
  const episodesPath = join(memoryDir, 'episodes.jsonl')
  const memoryReadmePath = join(memoryDir, 'README.md')
  const runtimeReadmePath = join(runtimeDir, 'README.md')

  await writeJsonFile({
    path: configPath,
    overwrite: input.overwrite,
    data: {
      name: input.name,
      profile: input.profile,
      targetDir,
      generatedAt: new Date().toISOString(),
    },
  })

  await writeJsonFile({
    path: modelsPath,
    overwrite: input.overwrite,
    data: {
      primary: {
        baseUrl: input.primaryBaseUrl ?? null,
        model: input.primaryModel ?? null,
      },
      vision: {
        baseUrl: input.visionBaseUrl ?? null,
        model: input.visionModel ?? null,
      },
      tts: {
        baseUrl: input.ttsBaseUrl ?? null,
        model: input.ttsModel ?? null,
      },
    },
  })

  await writeJsonFile({
    path: infrastructurePath,
    overwrite: input.overwrite,
    data: {
      profile: input.profile,
      persistence: {
        provider: input.memoryProvider,
        directory: '.plaited/memory',
      },
      execution: {
        provider: input.sandboxProvider,
      },
      sync: {
        provider: input.syncProvider,
      },
    },
  })

  await writeTextFile({
    path: observationsPath,
    overwrite: input.overwrite,
    content: '',
  })

  await writeTextFile({
    path: episodesPath,
    overwrite: input.overwrite,
    content: '',
  })

  await writeTextFile({
    path: memoryReadmePath,
    overwrite: input.overwrite,
    content: [
      '# Plaited Memory',
      '',
      'This directory is the default durable memory root for the bootstrapped agent.',
      '',
      '- `observations.jsonl` is for compact working-memory observations',
      '- `episodes.jsonl` is for episodic reflections',
      '- a lightweight SQLite index may be created here at runtime',
      '',
    ].join('\n'),
  })

  await writeTextFile({
    path: runtimeReadmePath,
    overwrite: input.overwrite,
    content: [
      '# Plaited Runtime',
      '',
      'This directory captures deployment-oriented runtime metadata for the bootstrapped agent.',
      '',
      '- `../config/bootstrap.json` stores the bootstrap manifest',
      '- `../config/models.json` stores model endpoint configuration',
      '- `../config/infrastructure.json` stores sandbox, memory, and sync choices',
      '',
    ].join('\n'),
  })

  return {
    name: input.name,
    targetDir,
    profile: input.profile,
    configPath,
    createdPaths: [
      configPath,
      modelsPath,
      infrastructurePath,
      observationsPath,
      episodesPath,
      memoryReadmePath,
      runtimeReadmePath,
    ],
    nextSteps: getNextSteps({
      configPath,
      sandboxProvider: input.sandboxProvider,
      syncProvider: input.syncProvider,
    }),
  }
}
