import { stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as z from 'zod'
import {
  behavioral,
  createSupervisorRuntime,
  isActorDefinition,
  isExtension,
  useExtension,
  useInstaller,
} from '../behavioral.ts'
import { createAgentCoreExecutionProcessHandlers } from '../modules/execution-process-actor.ts'
import * as modules from '../modules.ts'
import { AGENT_CORE, AGENT_CORE_EVENTS } from './agent.constants.ts'
import type { CreateAgentOptions } from './agent.types.ts'

const DEFAULT_ACTORS_DIRECTORY = '.plaited/actors'
const ACTOR_FILE_GLOB = '*.ts'

const ActorsScanDetailSchema = z
  .object({
    directory: z.string().min(1).optional(),
  })
  .optional()

const directoryExists = async (path: string) => {
  try {
    return (await stat(path)).isDirectory()
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * Creates the minimal agent core around the behavioral engine.
 *
 * @remarks
 * The core owns only:
 * - behavioral engine setup
 * - host trigger ingress
 * - disconnect cleanup
 * - actor onboarding
 * - temporary installation of executable extensions
 *
 * Everything richer should be layered on through module runtime actors.
 *
 * @public
 */
export const createAgent = async ({ maxKeys, ttlMs, workspace }: CreateAgentOptions) => {
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const installer = useInstaller({ trigger, useSnapshot, reportSnapshot, addBThread, ttlMs, maxKeys })
  const supervisor = createSupervisorRuntime()
  const workspaceRoot = resolve(workspace)
  const resolveWorkspacePath = (detail: string) => {
    const resolved = resolve(workspaceRoot, detail)
    if (resolved !== workspaceRoot && !resolved.startsWith(`${workspaceRoot}${sep}`)) {
      throw new Error(`Path "${detail}" resolves outside workspace "${workspaceRoot}"`)
    }
    return resolved
  }
  const installedExtensionIds = new Set<string>()
  const installExtension = (value: unknown) => {
    if (!isExtension(value) || installedExtensionIds.has(value.id)) {
      return
    }
    useFeedback(installer(value))
    installedExtensionIds.add(value.id)
  }
  const installActorFileDefaultExport = async (path: string) => {
    const moduleExports = await import(pathToFileURL(resolveWorkspacePath(path)).href)
    const defaultExport = (moduleExports as { default?: unknown }).default
    if (isActorDefinition(defaultExport)) {
      await supervisor.onboardActor(defaultExport)
      return
    }
    installExtension(defaultExport)
  }
  const scanActorDirectory = async (directory = DEFAULT_ACTORS_DIRECTORY) => {
    const actorsDirectory = resolveWorkspacePath(directory)
    if (!(await directoryExists(actorsDirectory))) {
      return
    }

    const actorFiles: string[] = []
    const glob = new Bun.Glob(ACTOR_FILE_GLOB)
    for await (const actorFile of glob.scan({ cwd: actorsDirectory, absolute: true, onlyFiles: true })) {
      actorFiles.push(actorFile)
    }
    actorFiles.sort()

    for (const actorFile of actorFiles) {
      await installActorFileDefaultExport(actorFile)
    }
  }

  const coreExtension = useExtension(AGENT_CORE, (params) => {
    const { bSync, bThread } = params
    bThread({
      label: 'onActorsScan',
      rules: [
        bSync({
          block: {
            type: AGENT_CORE_EVENTS.actors_scan,
            detailSchema: ActorsScanDetailSchema,
            detailMatch: 'invalid',
          },
        }),
      ],
      repeat: true,
    })
    const executionProcessHandlers = createAgentCoreExecutionProcessHandlers({
      ...params,
      resolveWorkspacePath,
      workspaceRoot,
    })

    return {
      ...executionProcessHandlers,
      async [AGENT_CORE_EVENTS.actors_scan](detail: unknown) {
        const scanDetail = ActorsScanDetailSchema.parse(detail)
        await scanActorDirectory(scanDetail?.directory)
      },
    }
  })

  for (const extension of [coreExtension, ...Object.values(modules)]) {
    installExtension(extension)
  }
  await scanActorDirectory()

  return trigger
}
