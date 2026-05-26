import { behavioral } from '../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS } from '../shared/shared.constants.ts'
// biome-ignore lint/correctness/noUnusedImports: WIP checkpoint
import { WORKER_PATH } from '../worker.ts'

// biome-ignore lint/correctness/noUnusedVariables: WIP checkpoint
const { addHandler, addThread, reportSnapshot, trigger, useSnapshot } = behavioral()

import type { AttrsMessage, DisconnectMessage, ImportModuleMessage, RenderMessage } from '../shared/shared.schemas.ts'

// addThread(UI_PROJECTION_EVENTS.ui_attrs_requested,
//   () => {

//   })

/**
 * request read
 * request write
 * request execute
 *
 */

addHandler<AttrsMessage>(AGENT_TO_CONTROLLER_EVENTS.attrs, () => {})

addHandler<DisconnectMessage>(AGENT_TO_CONTROLLER_EVENTS.disconnect, () => {})

addHandler<ImportModuleMessage>(AGENT_TO_CONTROLLER_EVENTS.import, () => {})

addHandler<RenderMessage>(AGENT_TO_CONTROLLER_EVENTS.render, () => {})
