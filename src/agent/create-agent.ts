import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as z from 'zod'
import { behavioral, isExtension, notSchema, useExtension, useInstaller } from '../behavioral.ts'
import * as modules from '../modules.ts'
import { AGENT_CORE, AGENT_CORE_EVENTS } from './agent.constants.ts'
import { type BashDetail, BashDetailSchema } from './agent.schemas.ts'
import type { CreateAgentOptions } from './agent.types.ts'

/**
 * Creates the minimal agent core around the behavioral engine.
 *
 * @remarks
 * The core owns only:
 * - behavioral engine setup
 * - host trigger ingress
 * - heartbeat pulse
 * - disconnect cleanup
 * - installation of executable extensions
 *
 * Everything richer should be layered on through extensions.
 *
 * @public
 */
export const createAgent = async ({ maxKeys, ttlMs, workspace }: CreateAgentOptions) => {
  const { addBThread, trigger, useFeedback, useSnapshot, reportSnapshot } = behavioral()
  const installer = useInstaller({ trigger, useSnapshot, reportSnapshot, addBThread, ttlMs, maxKeys })

  const resolveWorkspacePath = (detail: string) => (isAbsolute(detail) ? detail : resolve(workspace, detail))

  const coreExtension = useExtension(AGENT_CORE, ({ bThread, bSync }) => {
    bThread({
      label: 'onBash',
      rules: [
        bSync({
          block: {
            type: AGENT_CORE_EVENTS.bash,
            detailSchema: notSchema(BashDetailSchema),
          },
        }),
      ],
      repeat: true,
    })
    bThread({
      label: 'onUpdateModules',
      rules: [
        bSync({
          block: {
            type: AGENT_CORE_EVENTS.update_modules,
            detailSchema: notSchema(z.string()),
          },
        }),
      ],
      repeat: true,
    })
    return {
      async [AGENT_CORE_EVENTS.update_modules](detail: string) {
        const moduleExports = await import(pathToFileURL(resolveWorkspacePath(detail)).href)
        for (const value of Object.values(moduleExports)) {
          if (isExtension(value)) useFeedback(installer(value))
        }
      },
      async [AGENT_CORE_EVENTS.bash](detail: BashDetail) {
        Bun.spawn(['bun', resolveWorkspacePath(detail.path), ...detail.args], {
          stdout: 'pipe',
          stderr: 'pipe',
        })
      },
    }
  })

  for (const extension of [coreExtension, ...Object.values(modules)]) {
    if (isExtension(extension)) useFeedback(installer(extension))
  }

  return trigger
}
