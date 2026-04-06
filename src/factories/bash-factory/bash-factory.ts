import type { Factory } from '../../agent.ts'
import { BASH_FACTORY_EVENTS, BASH_FACTORY_SIGNAL_KEYS } from './bash-factory.constants.ts'
import {
  type BashExecutionProfile,
  type BashExecutionState,
  BashExecutionStateSchema,
  MarkBashExecutionResultDetailSchema,
  NullableBashExecutionStateSchema,
  RequestBashExecutionDetailSchema,
} from './bash-factory.schemas.ts'
import type { CreateBashFactoryOptions } from './bash-factory.types.ts'

const classifyExecutionProfile = ({ path, args }: { path: string; args: string[] }): BashExecutionProfile => {
  const joined = `${path} ${args.join(' ')}`.toLowerCase()
  if (/\brm\b|\bdelete\b|\bremove\b/.test(joined)) return 'destructive'
  if (/\bwrite\b|\bapply\b|\bpatch\b|\bfix\b/.test(joined)) return 'workspace_write'
  if (/\bwatch\b|\bserve\b|\bdaemon\b/.test(joined)) return 'background'
  return 'read_only'
}

/**
 * Creates the bounded bash-execution policy factory.
 *
 * @remarks
 * This lane will own execution policy around the minimal `AGENT_EVENTS.bash`
 * primitive.
 *
 * @public
 */
export const createBashFactory =
  ({ stateSignalKey = BASH_FACTORY_SIGNAL_KEYS.state }: CreateBashFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const stateSignal =
      signals.get(stateSignalKey) ??
      signals.set({
        key: stateSignalKey,
        schema: NullableBashExecutionStateSchema,
        value: null,
        readOnly: false,
      })

    const publish = (state: BashExecutionState) => {
      stateSignal.set?.(state)
      trigger({
        type: BASH_FACTORY_EVENTS.bash_factory_updated,
        detail: {
          profile: state.profile,
          status: state.status,
          path: state.path,
        },
      })
    }

    return {
      handlers: {
        [BASH_FACTORY_EVENTS.bash_factory_request](detail) {
          const parsed = RequestBashExecutionDetailSchema.safeParse(detail)
          if (!parsed.success) return
          publish(
            BashExecutionStateSchema.parse({
              path: parsed.data.path,
              args: parsed.data.args,
              profile: classifyExecutionProfile(parsed.data),
              status: 'requested',
            }),
          )
        },
        [BASH_FACTORY_EVENTS.bash_factory_mark_result](detail) {
          const parsed = MarkBashExecutionResultDetailSchema.safeParse(detail)
          if (!parsed.success) return
          const current = (stateSignal.get() ?? null) as BashExecutionState | null
          if (!current) return
          publish(
            BashExecutionStateSchema.parse({
              ...current,
              status: parsed.data.status,
              summary: parsed.data.summary,
            }),
          )
        },
      },
    }
  }
