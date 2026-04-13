import type { Module } from '../../agent.ts'
import { VERIFICATION_MODULE_EVENTS } from '../verification-module/verification-module.constants.ts'
import { EDIT_MODULE_EVENTS, EDIT_MODULE_SIGNAL_KEYS } from './edit-module.constants.ts'
import {
  ApplyEditDetailSchema,
  type EditState,
  EditStateSchema,
  NullableEditStateSchema,
  RequestEditDetailSchema,
} from './edit-module.schemas.ts'
import type { CreateEditModuleOptions } from './edit-module.types.ts'

const classifyStrategy = ({ intent, files }: { intent: string; files: string[] }): EditState['strategy'] => {
  const lowerIntent = intent.toLowerCase()
  const docOnly = files.every((file) => /\.(md|mdx|txt)$/i.test(file))
  if (lowerIntent.includes('repair')) return 'repair'
  if (docOnly) return 'doc_only'
  if (files.length > 1) return 'multi_file'
  return 'targeted_patch'
}

/**
 * Creates the bounded edit-state module.
 *
 * @public
 */
export const createEditModule =
  ({ editSignalKey = EDIT_MODULE_SIGNAL_KEYS.state }: CreateEditModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const editSignal =
      signals.get(editSignalKey) ??
      signals.set({
        key: editSignalKey,
        schema: NullableEditStateSchema,
        value: null,
        readOnly: false,
      })

    const publish = (state: EditState) => {
      editSignal.set?.(state)
      trigger({
        type: EDIT_MODULE_EVENTS.edit_module_updated,
        detail: {
          strategy: state.strategy,
          status: state.status,
          changedFiles: state.changedFiles,
        },
      })
    }

    return {
      handlers: {
        [EDIT_MODULE_EVENTS.edit_module_request](detail) {
          const parsed = RequestEditDetailSchema.safeParse(detail)
          if (!parsed.success) return
          publish(
            EditStateSchema.parse({
              intent: parsed.data.intent,
              files: parsed.data.files,
              strategy: classifyStrategy(parsed.data),
              status: 'proposed',
              changedFiles: [],
            }),
          )
        },
        [EDIT_MODULE_EVENTS.edit_module_apply](detail) {
          const parsed = ApplyEditDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (editSignal.get() ?? null) as EditState | null
          if (!current) return
          publish(
            EditStateSchema.parse({
              ...current,
              status: 'applying',
              changedFiles: parsed.data.changedFiles,
              note: parsed.data.note,
            }),
          )
        },
        [EDIT_MODULE_EVENTS.edit_module_mark_ready]() {
          const current = (editSignal.get() ?? null) as EditState | null
          if (!current) return
          const next = EditStateSchema.parse({
            ...current,
            status: 'ready_for_verification',
          })
          publish(next)
          trigger({ type: VERIFICATION_MODULE_EVENTS.verification_module_run })
        },
        [EDIT_MODULE_EVENTS.edit_module_mark_repair](detail) {
          const current = (editSignal.get() ?? null) as EditState | null
          if (!current) return
          publish(
            EditStateSchema.parse({
              ...current,
              strategy: 'repair',
              status: 'needs_repair',
              note: typeof detail === 'string' ? detail : current.note,
            }),
          )
        },
      },
    }
  }
